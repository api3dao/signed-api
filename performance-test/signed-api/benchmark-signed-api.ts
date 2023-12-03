async function main() {
  let successCount = 0,
    failCount = 0;

  const requestTimes: number[] = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();

    // eslint-disable-next-line functional/no-try-statements
    try {
      await fetch(
        'http://signed-api-elb-679853871.us-east-2.elb.amazonaws.com/0s-delay/0xaca247c17580BEEc0DC2Fd229FfdbC3718fF8232'
      ).then((res) => res.json() as any);
      successCount++;
    } catch {
      failCount++;
    }
    const end = performance.now();
    requestTimes.push(end - start);

    console.info(`Success: ${successCount}, Fail: ${failCount}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.info(`Min time: ${Math.min(...requestTimes)}`);
  console.info(`Max time: ${Math.max(...requestTimes)}`);
  console.info(`Median time: ${requestTimes.toSorted()[requestTimes.length / 2]}`);
  const averageTime = requestTimes.reduce((acc, curr) => acc + curr, 0) / requestTimes.length;
  console.info(`Average time: ${averageTime}`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void main();
