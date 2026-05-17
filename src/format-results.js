function toAbsoluteUrl(siteOrigin, maybeRelativeUrl) {
  if (!maybeRelativeUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(maybeRelativeUrl)) {
    return maybeRelativeUrl;
  }

  return `${siteOrigin}${maybeRelativeUrl}`;
}

function pickBestBookingOption(result) {
  if (!Array.isArray(result?.bookingOptions) || result.bookingOptions.length === 0) {
    return null;
  }

  return [...result.bookingOptions].sort((left, right) => {
    const leftPrice = left?.displayPrice?.price ?? left?.fees?.totalPrice?.price ?? Number.MAX_SAFE_INTEGER;
    const rightPrice = right?.displayPrice?.price ?? right?.fees?.totalPrice?.price ?? Number.MAX_SAFE_INTEGER;
    return leftPrice - rightPrice;
  })[0];
}

function buildSegmentSummary(segment, airports, airlines) {
  const originAirport = airports?.[segment?.origin];
  const destinationAirport = airports?.[segment?.destination];
  const airline = airlines?.[segment?.airline];

  return {
    flightNumber: segment?.flightNumber ? `${segment?.airline ?? ""}${segment.flightNumber}` : null,
    airline: airline?.name ?? segment?.airline ?? null,
    origin: {
      code: segment?.origin ?? null,
      city: originAirport?.cityName ?? null,
      airport: originAirport?.fullDisplayName ?? originAirport?.displayName ?? null
    },
    destination: {
      code: segment?.destination ?? null,
      city: destinationAirport?.cityName ?? null,
      airport: destinationAirport?.fullDisplayName ?? destinationAirport?.displayName ?? null
    },
    departureTime: segment?.departure ?? null,
    arrivalTime: segment?.arrival ?? null,
    durationMinutes: segment?.duration ?? null
  };
}

function buildLegSummary(leg, lookup) {
  const segmentIds = Array.isArray(leg?.segments) ? leg.segments.map((segment) => segment.id) : [];
  const segments = segmentIds
    .map((segmentId) => lookup.segments?.[segmentId])
    .filter(Boolean);

  const stopAirports = segments.slice(0, -1).map((segment) => segment.destination).filter(Boolean);
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  return {
    departureAirport: firstSegment?.origin ?? null,
    arrivalAirport: lastSegment?.destination ?? null,
    departureTime: firstSegment?.departure ?? null,
    arrivalTime: lastSegment?.arrival ?? null,
    durationMinutes:
      segments.reduce((total, segment) => total + (segment?.duration ?? 0), 0) || null,
    stops: Math.max(segments.length - 1, 0),
    stopAirports,
    segments: segments.map((segment) => buildSegmentSummary(segment, lookup.airports, lookup.airlines))
  };
}

export function formatKayakResults(data, options = {}) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const lookup = {
    airports: data?.airports ?? {},
    airlines: data?.airlines ?? {},
    segments: data?.segments ?? {}
  };
  const siteOrigin = options.siteOrigin ?? "https://www.kayak.co.jp";

  return results.map((result) => {
    const bookingOption = pickBestBookingOption(result);
    const providerName = result?.fsrData?.sponsoredView?.providerName ?? bookingOption?.providerCode ?? null;

    return {
      resultId: result?.resultId ?? null,
      type: result?.type ?? null,
      isBest: result?.isBest ?? false,
      isCheapest: result?.isCheapest ?? false,
      price: {
        amount: bookingOption?.displayPrice?.price ?? bookingOption?.fees?.totalPrice?.price ?? null,
        currency: bookingOption?.displayPrice?.currency ?? bookingOption?.fees?.totalPrice?.currency ?? null,
        display: bookingOption?.displayPrice?.localizedPrice ?? bookingOption?.fees?.totalPrice?.localizedPrice ?? null
      },
      provider: {
        code: bookingOption?.providerCode ?? null,
        name: providerName
      },
      links: {
        details: toAbsoluteUrl(siteOrigin, result?.shareableUrl),
        booking: toAbsoluteUrl(siteOrigin, bookingOption?.bookingUrl?.url)
      },
      legs: Array.isArray(result?.legs) ? result.legs.map((leg) => buildLegSummary(leg, lookup)) : []
    };
  });
}
