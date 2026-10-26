import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface BookingConfirmationDetails {
  guestName: string;
  guestEmail: string;
  bookingReference: string;
  branchName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency: string;
}

export async function sendBookingConfirmationEmail(
  details: BookingConfirmationDetails,
): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!process.env.RESEND_API_KEY || !fromEmail) {
    throw new Error("Resend email configuration is missing.");
  }

  const {
    guestName,
    guestEmail,
    bookingReference,
    branchName,
    checkIn,
    checkOut,
    totalAmount,
    currency,
  } = details;

  const amount = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(totalAmount);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [guestEmail],
    subject: `LittleSpace booking confirmed - ${bookingReference}`,
    text: [
      `Hello ${guestName},`,
      "",
      "Your LittleSpace booking has been confirmed.",
      "",
      `Booking reference: ${bookingReference}`,
      `Hotel branch: ${branchName}`,
      `Check-in: ${checkIn}`,
      `Check-out: ${checkOut}`,
      `Total paid: ${amount}`,
      "",
      "Please keep your booking reference for your records.",
      "",
      "Thank you for choosing LittleSpace.",
    ].join("\n"),
    html: `
      <h2>Your LittleSpace booking is confirmed!</h2>
      <p>Hello ${guestName},</p>
      <p>Your payment has been verified and your booking is confirmed.</p>
      <ul>
        <li><strong>Booking reference:</strong> ${bookingReference}</li>
        <li><strong>Hotel branch:</strong> ${branchName}</li>
        <li><strong>Check-in:</strong> ${checkIn}</li>
        <li><strong>Check-out:</strong> ${checkOut}</li>
        <li><strong>Total paid:</strong> ${amount}</li>
      </ul>
      <p>Please keep your booking reference for your records.</p>
      <p>Thank you for choosing LittleSpace.</p>
    `,
  });

  if (error) {
    throw new Error(
      `Failed to send booking confirmation email: ${error.message}`,
    );
  }
}
