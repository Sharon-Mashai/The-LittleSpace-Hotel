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

export async function sendGuestBookingOtpEmail(
  guestEmail: string,
  otp: string,
  expiryMinutes = 5,
): Promise<void> {
  await emailTransporter.sendMail({
    from: {
      name: "LittleSpace Hotel",
      address: process.env.SMTP_USER!,
    },
    to: guestEmail,
    subject: "Your LittleSpace booking access code",
    text: `
Your LittleSpace Hotel verification code is: ${otp}

Enter this code on the My Bookings page to access your bookings.

This code expires in ${expiryMinutes} minutes.

If you did not request this code, you can ignore this email.

Kind regards,
LittleSpace Hotel
    `.trim(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
        <h2>LittleSpace Hotel</h2>
        <h3>My Bookings Verification</h3>
        <p>Use the verification code below to access your bookings:</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 8px; padding: 16px; background: #f3f3f3; text-align: center;">
          ${escapeHtml(otp)}
        </div>
        <p>This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
        <p>If you did not request this code, you can ignore this email.</p>
        <p>Kind regards,<br />LittleSpace Hotel</p>
      </div>
    `,
  });
}

// Send a password reset link to a guest.
export async function sendPasswordResetEmail(
  guestEmail: string,
  resetLink: string,
  expiryMinutes = 30,
): Promise<void> {
  await emailTransporter.sendMail({
    from: {
      name: "LittleSpace Hotel",
      address: process.env.SMTP_USER!,
    },
    to: guestEmail,
    subject: "Reset Your LittleSpace Password",
    text: `
You requested to reset your LittleSpace Hotel account password.

Click the link below to create a new password:

${resetLink}

This link expires in ${expiryMinutes} minutes and can only be used once.

If you did not request a password reset, you can ignore this email.

Kind regards,
LittleSpace Hotel
    `.trim(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
        <h2>LittleSpace Hotel</h2>
        <h3>Password Reset Request</h3>

        <p>You requested to reset your LittleSpace Hotel account password.</p>

        <p>Click the button below to create a new password:</p>

        <p style="margin: 25px 0;">
          <a
            href="${escapeHtml(resetLink)}"
            style="background: #333; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;"
          >
            Reset Password
          </a>
        </p>

        <p>This link expires in <strong>${expiryMinutes} minutes</strong> and can only be used once.</p>

        <p>If you did not request a password reset, you can ignore this email.</p>

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
