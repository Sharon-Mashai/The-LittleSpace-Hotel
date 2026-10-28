import { emailTransporter } from "./email.js";

interface BookingConfirmationDetails {
  guestName: string;
  guestEmail: string;
  bookingReference: string;
  branchName: string;
  checkIn: string;
  checkOut: string;
  roomName: string;
  nights: number;
  totalAmount: string;
  currency: string;
}

export async function sendBookingConfirmationEmail(
  booking: BookingConfirmationDetails,
): Promise<void> {
  const {
    guestName,
    guestEmail,
    bookingReference,
    branchName,
    checkIn,
    checkOut,
    roomName,
    nights,
    totalAmount,
    currency,
  } = booking;

  await emailTransporter.sendMail({
    from: {
      name: "LittleSpace Hotel",
      address: process.env.SMTP_USER!,
    },
    to: guestEmail,
    subject: `Booking Confirmation - ${bookingReference}`,
    text: `
Dear ${guestName},

Thank you for booking with LittleSpace Hotel.

Your payment has been confirmed and your booking is confirmed.

Booking reference: ${bookingReference}
Hotel branch: ${branchName}
Room: ${roomName}
Check-in: ${checkIn}
Check-out: ${checkOut}
Number of nights: ${nights}
Total paid: ${currency} ${totalAmount}

Please keep your booking reference for your records.

We look forward to welcoming you.

Kind regards,
LittleSpace Hotel
    `.trim(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
        <h2>LittleSpace Hotel</h2>
        <h3>Booking Confirmation</h3>
        <p>Dear ${escapeHtml(guestName)},</p>
        <p>Thank you for booking with LittleSpace Hotel. Your payment has been confirmed and your booking is confirmed.</p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Booking reference</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(bookingReference)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Hotel branch</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(branchName)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Room</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(roomName)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Check-in</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(checkIn)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Check-out</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(checkOut)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Nights</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${nights}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total paid</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(currency)} ${escapeHtml(totalAmount)}</td></tr>
        </table>
        <p>Please keep your booking reference for your records.</p>
        <p>We look forward to welcoming you.</p>
        <p>Kind regards,<br />LittleSpace Hotel</p>
      </div>
    `,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}
