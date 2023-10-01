import { DelayedSignedDataQueue } from './state';
import { nodarySignedTemplateResponses } from '../test/fixtures';

describe(DelayedSignedDataQueue.name, () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('can put signed data', () => {
    const queue = new DelayedSignedDataQueue(30);
    const data = nodarySignedTemplateResponses[0]![1];

    queue.put(data);

    expect(queue.getAll()).toEqual([data]);
  });

  it('can get signed data with delay', () => {
    const queue = new DelayedSignedDataQueue(30);
    const data3 = nodarySignedTemplateResponses[0]![1];
    const timestamp = parseInt(data3.timestamp);
    const data2 = { ...data3, timestamp: (timestamp - 10).toString() };
    const data1 = { ...data3, timestamp: (timestamp - 20).toString() };
    queue.put(data1);
    queue.put(data2);
    queue.put(data3);

    expect(queue.get(timestamp + 1)).toEqual(data3);
    expect(queue.get(timestamp)).toEqual(data2);
    expect(queue.get(timestamp - 5)).toEqual(data2);
    expect(queue.get(timestamp - 15)).toEqual(data1);
    expect(queue.get(timestamp - 30)).toEqual(undefined);
  });

  it('ensures that data is inserted by increasing timestamp', () => {
    const queue = new DelayedSignedDataQueue(30);
    const data3 = nodarySignedTemplateResponses[0]![1];
    const timestamp = parseInt(data3.timestamp);
    const data2 = { ...data3, timestamp: (timestamp - 10).toString() };
    const data1 = { ...data3, timestamp: (timestamp - 20).toString() };
    queue.put(data3);

    expect(() => queue.put(data1)).toThrow('The signed data is too old');
    expect(() => queue.put(data2)).toThrow('The signed data is too old');
  });

  it('can prune unused data', () => {
    jest.useFakeTimers().setSystemTime(new Date('2023-01-20'));

    const queue = new DelayedSignedDataQueue(30);
    const data3 = nodarySignedTemplateResponses[0]![1];
    const timestamp = parseInt(data3.timestamp);
    const data2 = { ...data3, timestamp: (timestamp - 40).toString() };
    const data1 = { ...data3, timestamp: (timestamp - 50).toString() };
    queue.put(data1);
    queue.put(data2);
    queue.put(data3);

    queue.prune();

    expect(queue.getAll()).toEqual([data2, data3]);
  });
});
