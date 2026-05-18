# kayak-headless MCP

An MCP server that searches KAYAK flights by:

1. Opening a KAYAK results page in headless Chrome when needed
2. Capturing valid cookies and request headers
3. Reusing cached session data when still valid
4. Polling KAYAK until the search status becomes `complete`

## Install

```bash
npm install
npx playwright install chromium
```

## MCP usage

Start the stdio MCP server:

```bash
npm start
```

Example Claude Desktop style config:

```json
{
  "mcpServers": {
    "kayak-flights": {
      "command": "node",
      "args": ["/absolute/path/to/kayak-headless/src/index.js"]
    }
  }
}
```

## Tool

The server exposes one tool: `search_flights`

Main inputs:

- `origin`
- `destination`
- `departureDate`
- `returnDate`
- `adults`
- `children`
- `infants`
- `directOnly`
- `sort`
- `site`

It returns a compact payload with `count` and a flattened `results` array.

Each result keeps only the main fields, for example:

- `price`, `currency`, `priceText`
- `provider`, `providerCode`
- `detailsUrl`, `bookingUrl`
- `outboundDepartureTime`, `outboundArrivalTime`
- `outboundDepartureAirport`, `outboundArrivalAirport`
- `outboundStops`, `outboundStopAirports`, `outboundFlightNumbers`
- return leg equivalents like `returnDepartureTime` when present

## Local CLI

For debugging without MCP:

```bash
npm run fetch -- --origin TYO --destination TPE --departureDate 2026-06-18
```

## Cache

Session cache files are stored under `.cache/` and are separated by KAYAK hostname.
