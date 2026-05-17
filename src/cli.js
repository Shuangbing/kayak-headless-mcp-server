import { fetchKayakPoll } from "./kayak-client.js";
import { buildSearchOptions } from "./kayak-api.js";

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = "true";
    }
  }

  return options;
}

function toInteger(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected integer but received: ${value}`);
  }
  return parsed;
}

function toBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  return value === "true";
}

function buildParams(argv) {
  const args = parseArgs(argv);
  const origin = args.origin ?? "TYO";
  const destination = args.destination ?? "TPE";
  const departureDate = args.departureDate ?? "2026-06-18";

  return {
    origin,
    destination,
    departureDate,
    returnDate: args.returnDate,
    adults: toInteger(args.adults, 1),
    children: toInteger(args.children, 0),
    infants: toInteger(args.infants, 0),
    pageNumber: toInteger(args.pageNumber, 1),
    directOnly: toBoolean(args.directOnly, false),
    sort: args.sort ?? "bestflight_a",
    ucs: args.ucs,
    site: args.site
  };
}

async function main() {
  const params = buildParams(process.argv.slice(2));
  const result = await fetchKayakPoll({
    ...buildSearchOptions(params)
  });

  console.log(
    JSON.stringify(
      {
        source: result.source,
        sessionCapturedAt: result.sessionCapturedAt,
        data: result.data
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  if (error.responseText) {
    console.error(error.responseText);
  }
  process.exitCode = 1;
});
