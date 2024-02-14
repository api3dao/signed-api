import { nodarySignedTemplateResponses } from '../test/fixtures';

import { DelayedSignedDataQueue } from './state';

describe(DelayedSignedDataQueue.name, () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('can put signed data', () => {
    const queue = new DelayedSignedDataQueue(30);
    const data = nodarySignedTemplateResponses[0]![1];

    queue.put(data);

    expect(queue.getAll()).toStrictEqual([data]);
  });

  it('can get signed data with delay', () => {
    const queue = new DelayedSignedDataQueue(30);
    const data3 = nodarySignedTemplateResponses[0]![1];
    const timestamp = Number.parseInt(data3.timestamp, 10);
    const data2 = { ...data3, timestamp: (timestamp - 10).toString() };
    const data1 = { ...data3, timestamp: (timestamp - 20).toString() };
    queue.put(data1);
    queue.put(data2);
    queue.put(data3);

    expect(queue.get(timestamp + 1)).toStrictEqual(data3);
    expect(queue.get(timestamp)).toStrictEqual(data2);
    expect(queue.get(timestamp - 5)).toStrictEqual(data2);
    expect(queue.get(timestamp - 15)).toStrictEqual(data1);
    expect(queue.get(timestamp - 30)).toBeUndefined();
  });

  it('ensures that data is inserted by increasing timestamp', () => {
    const queue = new DelayedSignedDataQueue(30);
    const data3 = nodarySignedTemplateResponses[0]![1];
    const timestamp = Number.parseInt(data3.timestamp, 10);
    const data2 = { ...data3, timestamp: (timestamp - 10).toString() };
    const data1 = { ...data3, timestamp: (timestamp - 20).toString() };
    queue.put(data3);

    expect(() => queue.put(data1)).toThrow('The signed data is too old');
    expect(() => queue.put(data2)).toThrow('The signed data is too old');
  });

  it('can prune unused data', () => {
    jest.useFakeTimers().setSystemTime(new Date('2023-01-20')); // 1674172800

    const queue = new DelayedSignedDataQueue(30);
    const data3 = nodarySignedTemplateResponses[0]![1];
    const timestamp = Number.parseInt(data3.timestamp, 10);
    const data2 = { ...data3, timestamp: (timestamp - 40).toString() };
    const data1 = { ...data3, timestamp: (timestamp - 50).toString() };
    queue.put(data1);
    queue.put(data2);
    queue.put(data3);

    queue.prune();

    expect(queue.getAll()).toStrictEqual([data2, data3]);
  });

  it('keeps data in the queue if none of the items exceed maxUpdateDelay', () => {
    jest.useFakeTimers().setSystemTime(new Date('2023-01-20')); // 1674172800
    const queue = new DelayedSignedDataQueue(30);
    const data = nodarySignedTemplateResponses[0]![1];
    const timestamp = Number.parseInt(data.timestamp, 10);
    const oldData = [
      { ...data, timestamp: (timestamp - 20).toString() },
      { ...data, timestamp: (timestamp - 15).toString() },
      { ...data, timestamp: (timestamp - 10).toString() },
    ];
    for (const item of oldData) queue.put(item);

    queue.prune();

    // All data points remain in the queue.
    expect(queue.getAll()).toStrictEqual(oldData);
  });
});
