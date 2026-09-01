import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { createNotificationHandler } from '../../src/notification';

function record(messageId: string, body: string): SQSRecord {
  return {
    messageId,
    receiptHandle: 'receipt',
    body,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '0',
      SenderId: 'sender',
      ApproximateFirstReceiveTimestamp: '0',
    },
    messageAttributes: {},
    md5OfBody: 'md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:queue',
    awsRegion: 'us-east-1',
  };
}

describe('notification handler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('publishes valid messages and returns malformed ones for retry/DLQ', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const handler = createNotificationHandler({
      topicArn: () => 'arn:topic',
      publish,
    });
    const event: SQSEvent = {
      Records: [
        record('ok', JSON.stringify({ message: 'Order ready', subject: 'Status' })),
        record('bad', JSON.stringify({ subject: 'Missing message' })),
      ],
    };

    await expect(handler(event)).resolves.toEqual({
      batchItemFailures: [{ itemIdentifier: 'bad' }],
    });
    expect(publish).toHaveBeenCalledWith(
      'arn:topic',
      { message: 'Order ready', subject: 'Status' },
      'ok',
    );
  });
});
