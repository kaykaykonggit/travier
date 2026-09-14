import { bookingFallbackUrl, bookingHow, bookingWhy, needsBooking } from "../lib/booking";
import type { Transport } from "../types";

export function BookingBox({
  transport,
  date,
  adults,
}: {
  transport: Transport;
  title: string;
  date?: string;
  adults?: number;
}) {
  if (!needsBooking(transport)) return null;
  const url = bookingFallbackUrl(transport, date, adults);
  return (
    <div className="booking-box" onClick={(event) => event.stopPropagation()}>
      <strong>需要預約</strong>
      <p>{bookingWhy(transport)} {bookingHow(transport)}</p>
      {url && (
        <a href={url} target="_blank" rel="noreferrer">
          預約
        </a>
      )}
    </div>
  );
}
