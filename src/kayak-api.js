const DEFAULT_SITE = "www.kayak.co.jp";
const DEFAULT_UCS = "14p2bou";

function formatAirportList(codes) {
  if (!codes || codes.length === 0) {
    throw new Error("Airport code list cannot be empty.");
  }

  return Array.from(new Set(codes.map((code) => code.trim().toUpperCase())));
}

function buildPassengerDetails({ adults = 1, children = 0, infants = 0 } = {}) {
  const passengerDetails = [];

  for (let index = 0; index < adults; index += 1) {
    passengerDetails.push({ ptc: "ADT" });
  }

  for (let index = 0; index < children; index += 1) {
    passengerDetails.push({ ptc: "CHD" });
  }

  for (let index = 0; index < infants; index += 1) {
    passengerDetails.push({ ptc: "INF" });
  }

  return passengerDetails;
}

function buildPassengersList({ adults = 1, children = 0, infants = 0 } = {}) {
  const passengers = [];

  for (let index = 0; index < adults; index += 1) {
    passengers.push("ADT");
  }

  for (let index = 0; index < children; index += 1) {
    passengers.push("CHD");
  }

  for (let index = 0; index < infants; index += 1) {
    passengers.push("INF");
  }

  return passengers;
}

export function buildSearchUrl(params) {
  const {
    site = DEFAULT_SITE,
    origin,
    destination,
    departureDate,
    returnDate,
    sort = "bestflight_a",
    ucs = DEFAULT_UCS,
    directOnly = false
  } = params;

  const route = `${origin.toUpperCase()}-${destination.toUpperCase()}`;
  const dates = returnDate ? `${departureDate}/${returnDate}` : departureDate;
  const url = new URL(`https://${site}/flights/${route}/${dates}`);

  url.searchParams.set("sort", sort);
  if (ucs) {
    url.searchParams.set("ucs", ucs);
  }
  if (directOnly) {
    url.searchParams.set("fs", "fdDir=true");
  }

  return url.toString();
}

export function buildPollBody(params) {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    adults = 1,
    children = 0,
    infants = 0,
    pageNumber = 1,
    directOnly = false
  } = params;

  const legs = [
    {
      origin: {
        airports: formatAirportList([origin]),
        locationType: "airports"
      },
      destination: {
        airports: formatAirportList([destination]),
        locationType: "airports"
      },
      date: departureDate,
      flex: "exact"
    }
  ];

  if (returnDate) {
    legs.push({
      origin: {
        airports: formatAirportList([destination]),
        locationType: "airports"
      },
      destination: {
        airports: formatAirportList([origin]),
        locationType: "airports"
      },
      date: returnDate,
      flex: "exact"
    });
  }

  return {
    filterParams: {
      fs: `fdDir=${directOnly ? "true" : "false"}`
    },
    userSearchParams: {
      legs,
      pageType: "results",
      passengers: buildPassengersList({ adults, children, infants }),
      passengerDetails: buildPassengerDetails({ adults, children, infants })
    },
    searchMetaData: {
      pageNumber,
      searchTypes: []
    }
  };
}

export function buildSearchOptions(params) {
  const site = params.site ?? DEFAULT_SITE;
  const searchUrl = buildSearchUrl({ ...params, site });
  const requestBody = buildPollBody(params);
  const cacheFile = `.cache/kayak-session-${site.replace(/[^a-z0-9.-]/gi, "_")}.json`;

  return {
    cacheFile,
    searchUrl,
    requestBody,
    site,
    origin: `https://${site}`,
    referer: searchUrl
  };
}

export const kayakApiDefaults = {
  DEFAULT_SITE,
  DEFAULT_UCS
};
