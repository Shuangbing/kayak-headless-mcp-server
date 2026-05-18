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

function buildLegSummary(leg, lookup) {
  const segmentIds = Array.isArray(leg?.segments) ? leg.segments.map((segment) => segment.id) : [];
  const segments = segmentIds
    .map((segmentId) => lookup.segments?.[segmentId])
    .filter(Boolean);

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
    stopAirports: segments.slice(0, -1).map((segment) => segment.destination).filter(Boolean),
    flightNumbers: segments
      .map((segment) =>
        segment?.flightNumber ? `${segment?.airline ?? ""}${segment.flightNumber}` : null
      )
      .filter(Boolean)
  };
}

function flattenLeg(summary, prefix) {
  if (!summary) {
    return {};
  }

  return {
    [`${prefix}DepartureAirport`]: summary.departureAirport,
    [`${prefix}ArrivalAirport`]: summary.arrivalAirport,
    [`${prefix}DepartureTime`]: summary.departureTime,
    [`${prefix}ArrivalTime`]: summary.arrivalTime,
    [`${prefix}DurationMinutes`]: summary.durationMinutes,
    [`${prefix}Stops`]: summary.stops,
    [`${prefix}StopAirports`]: summary.stopAirports,
    [`${prefix}FlightNumbers`]: summary.flightNumbers
  };
}

export function formatKayakResults(data, options = {}) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const lookup = {
    segments: data?.segments ?? {}
  };
  const siteOrigin = options.siteOrigin ?? "https://www.kayak.co.jp";

  return results.map((result, index) => {
    const bookingOption = pickBestBookingOption(result);
    const providerName = result?.fsrData?.sponsoredView?.providerName ?? bookingOption?.providerCode ?? null;
    const legs = Array.isArray(result?.legs) ? result.legs.map((leg) => buildLegSummary(leg, lookup)) : [];
    const outbound = legs[0] ?? null;
    const inbound = legs[1] ?? null;

    return {
      rank: index + 1,
      resultId: result?.resultId ?? null,
      best: result?.isBest ?? false,
      cheapest: result?.isCheapest ?? false,
      price: bookingOption?.displayPrice?.price ?? bookingOption?.fees?.totalPrice?.price ?? null,
      currency: bookingOption?.displayPrice?.currency ?? bookingOption?.fees?.totalPrice?.currency ?? null,
      priceText:
        bookingOption?.displayPrice?.localizedPrice ?? bookingOption?.fees?.totalPrice?.localizedPrice ?? null,
      provider: providerName,
      providerCode: bookingOption?.providerCode ?? null,
      detailsUrl: toAbsoluteUrl(siteOrigin, result?.shareableUrl),
      bookingUrl: toAbsoluteUrl(siteOrigin, bookingOption?.bookingUrl?.url),
      legCount: legs.length,
      totalStops: legs.reduce((total, leg) => total + (leg?.stops ?? 0), 0),
      totalDurationMinutes:
        legs.reduce((total, leg) => total + (leg?.durationMinutes ?? 0), 0) || null,
      ...flattenLeg(outbound, "outbound"),
      ...flattenLeg(inbound, "return")
    };
  });
}
