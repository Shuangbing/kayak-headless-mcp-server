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
- `limit`
- `site`

`sort` controls KAYAK ordering, and `limit` can be used to return only the first `N` items from that sorted list.

It returns a compact payload with `count` and a flattened `results` array.

Each result keeps only the main fields, for example:

- `price`, `currency`, `priceText`
- `provider`, `providerCode`
- `detailsUrl`, `bookingUrl`
- `outboundDepartureTime`, `outboundArrivalTime`
- `outboundDepartureAirport`, `outboundArrivalAirport`
- `outboundStops`, `outboundStopAirports`, `outboundFlightNumbers`
- return leg equivalents like `returnDepartureTime` when present

Example output:

```json
{
  "count": 2,
  "results": [
    {
      "rank": 1,
      "resultId": "abc123",
      "best": true,
      "cheapest": false,
      "price": 42800,
      "currency": "JPY",
      "priceText": "￥42,800",
      "provider": "Hahn Air",
      "providerCode": "hahn",
      "detailsUrl": "https://www.kayak.co.jp/flights/TYO-TPE/2026-06-18?sort=bestflight_a",
      "bookingUrl": "https://www.kayak.co.jp/r/booking-example",
      "legCount": 1,
      "totalStops": 0,
      "totalDurationMinutes": 245,
      "outboundDepartureAirport": "HND",
      "outboundArrivalAirport": "TPE",
      "outboundDepartureTime": "2026-06-18T09:10:00",
      "outboundArrivalTime": "2026-06-18T12:15:00",
      "outboundDurationMinutes": 245,
      "outboundStops": 0,
      "outboundStopAirports": [],
      "outboundFlightNumbers": ["CI221"]
    },
    {
      "rank": 2,
      "resultId": "def456",
      "best": false,
      "cheapest": true,
      "price": 39100,
      "currency": "JPY",
      "priceText": "￥39,100",
      "provider": "Trip.com",
      "providerCode": "trip",
      "detailsUrl": "https://www.kayak.co.jp/flights/TYO-TPE/2026-06-18?sort=price_a",
      "bookingUrl": "https://www.kayak.co.jp/r/booking-example-2",
      "legCount": 2,
      "totalStops": 2,
      "totalDurationMinutes": 640,
      "outboundDepartureAirport": "NRT",
      "outboundArrivalAirport": "TPE",
      "outboundDepartureTime": "2026-06-18T13:20:00",
      "outboundArrivalTime": "2026-06-18T18:40:00",
      "outboundDurationMinutes": 320,
      "outboundStops": 1,
      "outboundStopAirports": ["HKG"],
      "outboundFlightNumbers": ["CX501", "CX450"],
      "returnDepartureAirport": "TPE",
      "returnArrivalAirport": "NRT",
      "returnDepartureTime": "2026-06-25T10:30:00",
      "returnArrivalTime": "2026-06-25T15:50:00",
      "returnDurationMinutes": 320,
      "returnStops": 1,
      "returnStopAirports": ["HKG"],
      "returnFlightNumbers": ["CX451", "CX500"]
    }
  ]
}
```

## Local CLI

For debugging without MCP:

```bash
npm run fetch -- --origin TYO --destination TPE --departureDate 2026-06-18
```

Limit the output to the top 3 sorted results:

```bash
npm run fetch -- --origin TYO --destination TPE --departureDate 2026-06-18 --sort price_a --limit 3
```

## Cache

Session cache files are stored under `.cache/` and are separated by KAYAK hostname.
