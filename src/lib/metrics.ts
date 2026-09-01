type SendDistributionMetric = (
  metricName: string,
  value: number,
  ...tags: string[]
) => void;

let sendDistributionMetric: SendDistributionMetric | undefined;

function metricSender(): SendDistributionMetric | undefined {
  if (process.env.DD_ENABLED !== 'true') {
    return undefined;
  }
  if (sendDistributionMetric) {
    return sendDistributionMetric;
  }

  try {
    const module = require('datadog-lambda-js') as {
      sendDistributionMetric: SendDistributionMetric;
    };
    sendDistributionMetric = module.sendDistributionMetric;
    return sendDistributionMetric;
  } catch {
    return undefined;
  }
}

export function emitAuthMetric(
  result: 'success' | 'failure',
  reason: string,
): void {
  metricSender()?.(
    `oficina.auth.${result}`,
    1,
    `result:${result}`,
    `reason:${reason}`,
  );
}
