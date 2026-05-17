import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod";

import { buildSearchOptions } from "./kayak-api.js";
import { fetchKayakPoll } from "./kayak-client.js";
import { formatKayakResults } from "./format-results.js";

const server = new McpServer({
  name: "kayak-flights",
  version: "1.0.0"
});

server.registerTool(
  "search_flights",
  {
    title: "Search Kayak Flights",
    description:
      "Search flights on KAYAK using a browser-backed session cache and return the final completed poll result.",
    inputSchema: z.object({
      origin: z.string().min(3).describe("Origin airport or metro code, for example TYO."),
      destination: z.string().min(3).describe("Destination airport or metro code, for example TPE."),
      departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Departure date in YYYY-MM-DD format."),
      returnDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Optional return date in YYYY-MM-DD format."),
      adults: z.number().int().min(1).max(9).default(1).describe("Number of adult passengers."),
      children: z.number().int().min(0).max(8).default(0).describe("Number of child passengers."),
      infants: z.number().int().min(0).max(8).default(0).describe("Number of infant passengers."),
      pageNumber: z.number().int().min(1).default(1).describe("Results page number."),
      directOnly: z.boolean().default(false).describe("Whether to search nonstop flights only."),
      sort: z
        .string()
        .default("bestflight_a")
        .describe("KAYAK sort mode, for example bestflight_a or price_a."),
      site: z
        .string()
        .default("www.kayak.co.jp")
        .describe("KAYAK site hostname, for example www.kayak.co.jp."),
      ucs: z.string().optional().describe("Optional KAYAK ucs query parameter."),
      pollIntervalMs: z.number().int().min(1000).default(3000).describe("Polling interval in milliseconds."),
      maxPollAttempts: z.number().int().min(1).max(120).default(40).describe("Maximum poll attempts before timing out.")
    })
  },
  async (input) => {
    const searchOptions = buildSearchOptions(input);
    const result = await fetchKayakPoll({
      ...searchOptions,
      pollIntervalMs: input.pollIntervalMs,
      maxPollAttempts: input.maxPollAttempts
    });

    const structuredContent = {
      results: formatKayakResults(result.data, {
        siteOrigin: searchOptions.origin
      })
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
