import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { correlationIdFrom } from './lib/correlation';
import { errorMetadata, log } from './lib/logger';

interface NotificationPayload {
  message: string;
  subject?: string;
}

interface NotificationDependencies {
  publish: (
    topicArn: string,
    payload: NotificationPayload,
    correlationId: string,
  ) => Promise<void>;
  topicArn: () => string;
}

type NotificationHandler = (event: SQSEvent) => Promise<SQSBatchResponse>;

const sns = new SNSClient({});

function notificationPayload(record: SQSRecord): NotificationPayload {
  const value: unknown = JSON.parse(record.body);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid notification payload');
  }
  const body = value as Record<string, unknown>;
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    throw new Error('Invalid notification message');
  }
  if (
    body.subject !== undefined &&
    (typeof body.subject !== 'string' || body.subject.length > 100)
  ) {
    throw new Error('Invalid notification subject');
  }
  return {
    message: body.message,
    ...(typeof body.subject === 'string' ? { subject: body.subject } : {}),
  };
}

const defaultDependencies: NotificationDependencies = {
  topicArn: () => {
    const topicArn = process.env.NOTIFICATION_TOPIC_ARN?.trim();
    if (!topicArn) {
      throw new Error('Missing NOTIFICATION_TOPIC_ARN');
    }
    return topicArn;
  },
  publish: async (topicArn, payload, correlationId) => {
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: payload.message,
        ...(payload.subject ? { Subject: payload.subject } : {}),
        MessageAttributes: {
          correlation_id: {
            DataType: 'String',
            StringValue: correlationId,
          },
        },
      }),
    );
  },
};

function recordCorrelationId(record: SQSRecord): string {
  const fromAttribute = record.messageAttributes.correlation_id?.stringValue;
  return correlationIdFrom(
    fromAttribute ? { 'x-correlation-id': fromAttribute } : undefined,
    record.messageId,
  );
}

export function createNotificationHandler(
  dependencies: NotificationDependencies = defaultDependencies,
): NotificationHandler {
  return async (event) => {
    const failures: SQSBatchResponse['batchItemFailures'] = [];
    await Promise.all(
      event.Records.map(async (record) => {
        const correlationId = recordCorrelationId(record);
        try {
          const payload = notificationPayload(record);
          await dependencies.publish(
            dependencies.topicArn(),
            payload,
            correlationId,
          );
          log('info', 'notification.published', correlationId, {
            outcome: 'success',
            message_id: record.messageId,
          });
        } catch (error) {
          failures.push({ itemIdentifier: record.messageId });
          log('error', 'notification.failed', correlationId, {
            outcome: 'failure',
            message_id: record.messageId,
            ...errorMetadata(error),
          });
        }
      }),
    );
    return { batchItemFailures: failures };
  };
}

export const handler = createNotificationHandler();
