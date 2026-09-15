async function main(): Promise<void> {
  const response = await fetch("http://127.0.0.1:3000/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: "pay_stream_2048",
      status: "settled",
      paidAt: "2026-08-18T12:30:00.000Z",
      amountMinor: 1299,
      currency: "USD",
      creatorName: "Mina Rivera",
      assetTitle: "Clinical Audio Masterclass",
      buyerEmail: "viewer@example.com"
    })
  });

  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
