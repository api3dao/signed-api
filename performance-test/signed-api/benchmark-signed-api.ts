async function main() {
  let successCount = 0,
    failCount = 0;

  while (true) {
    // eslint-disable-next-line functional/no-try-statements
    try {
      await fetch(
        'http://signed-api-elb-733097220.us-east-2.elb.amazonaws.com/0s-delay/0xaca247c17580BEEc0DC2Fd229FfdbC3718fF8232'
      ).then((res) => res.json() as any);
      successCount++;
    } catch {
      failCount++;
    }

    console.info(`Success: ${successCount}, Fail: ${failCount}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void main();
