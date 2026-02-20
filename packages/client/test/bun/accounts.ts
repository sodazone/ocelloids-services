import { createStewardAgent, QueryResult, steward } from "../..";
import { createWriteStream } from "fs";

type AccountResult = steward.SubstrateAccountResult

const client = createStewardAgent({
  httpUrl: 'https://dev-api.ocelloids.net/',
  wsUrl: 'wss://dev-api.ocelloids.net/',
  apiKey: 'eyJhbGciOiJFZERTQSIsImtpZCI6IklSU1FYWXNUc0pQTm9kTTJsNURrbkJsWkJNTms2SUNvc0xBRi16dlVYX289In0.ewogICJpc3MiOiAiZGV2LWFwaS5vY2VsbG9pZHMubmV0IiwKICAianRpIjogIjAxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwIiwKICAic3ViIjogInB1YmxpY0BvY2VsbG9pZHMiCn0K.bjjQYsdIN9Fx34S9Of5QSKxb8_aOtwURInOGSSc_DxrdZcnYWi-5nnZsh1v5rYWuRWNzLstX0h1ICSH_oAugAQ'
})

async function fetchAllAccountsToFile(outputPath: string) {
  const stream = createWriteStream(outputPath, { flags: "w" });

  let cursor: string | undefined = undefined;
  let hasNextPage = true;
  let total = 0;
  let isFirstItem = true;

  // Start JSON array
  stream.write("[\n");

  while (hasNextPage) {
    console.log("Fetching page...", cursor ? `cursor=${cursor}` : "first page");

    const res = (await client.query(
      { op: "accounts.list" },
      {
        cursor,
        limit: 100,
      }
    )) as unknown as QueryResult<AccountResult>;

    if (!res.items?.length) {
      break;
    }

    for (const account of res.items) {
      if (!isFirstItem) {
        stream.write(",\n");
      }

      stream.write(JSON.stringify(account));
      isFirstItem = false;
      total++;
    }

    hasNextPage = res.pageInfo?.hasNextPage ?? false;
    cursor = res.pageInfo?.endCursor;

    console.log(`Fetched ${res.items.length}. Total written: ${total}`);
  }

  // Close JSON array
  stream.write("\n]\n");

  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });

  console.log(`Finished. Total accounts written: ${total}`);
}

async function main() {
  try {
    await fetchAllAccountsToFile("./all-accounts.json");
    console.log("Saved to all-accounts.json");
  } catch (err) {
    console.error("Error fetching accounts:", err);
    process.exit(1);
  }
}

main();
