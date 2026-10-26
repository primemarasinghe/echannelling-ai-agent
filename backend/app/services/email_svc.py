"""Email confirmation service using Gmail SMTP (free, built-in smtplib)."""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import get_settings

_log = logging.getLogger(__name__)


def _html_receipt(ref: str, appt_num: int, doctor: str, hospital: str,
                  date: str, time: str, patient_name: str,
                  patient_phone: str, total_lkr: float) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;
             overflow:hidden;box-shadow:0 4px 24px rgba(0,48,135,.10);">

        <!-- header -->
        <tr>
          <td style="background:linear-gradient(135deg,#003087 0%,#0057e7 100%);
                     padding:28px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:.3px;">
              eChannelling
            </div>
            <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px;">
              Nawaloka Hospital · Colombo
            </div>
          </td>
        </tr>

        <!-- confirmed banner -->
        <tr>
          <td style="background:#f0fdf4;padding:18px 32px;text-align:center;
                     border-bottom:1px solid #d1fae5;">
            <div style="display:inline-block;background:#16a34a;border-radius:50%;
                        width:38px;height:38px;line-height:38px;
                        text-align:center;font-size:20px;color:#fff;margin-bottom:8px;">✓</div>
            <div style="font-size:18px;font-weight:700;color:#15803d;">Booking Confirmed</div>
            <div style="font-size:13px;color:#166534;margin-top:4px;">
              Your appointment has been successfully booked.
            </div>
          </td>
        </tr>

        <!-- reference -->
        <tr>
          <td style="padding:20px 32px 0;text-align:center;">
            <div style="font-size:11px;font-weight:600;color:#888;letter-spacing:1px;
                        text-transform:uppercase;margin-bottom:6px;">Booking Reference</div>
            <div style="font-size:26px;font-weight:800;color:#003087;
                        font-family:monospace;letter-spacing:2px;">{ref}</div>
          </td>
        </tr>

        <!-- details -->
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              {''.join(_row(l, v) for l, v in [
                  ("Doctor",       doctor),
                  ("Hospital",     hospital),
                  ("Date & Time",  f"{date} at {time}"),
                  ("Appointment #", str(appt_num)),
                  ("Patient",      patient_name),
                  ("Phone",        patient_phone),
              ])}
            </table>
          </td>
        </tr>

        <!-- amount -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8faff;border:1px solid #dbeafe;
                          border-radius:10px;padding:14px 16px;">
              <tr>
                <td style="font-size:13px;color:#555;">Total Paid</td>
                <td style="font-size:18px;font-weight:800;color:#003087;
                           text-align:right;">
                  Rs.&nbsp;{total_lkr:,.2f}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td style="background:#f8faff;padding:16px 32px;text-align:center;
                     border-top:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#999;line-height:1.6;">
              Please arrive 15 minutes before your appointment time.<br>
              Bring this reference number and a valid ID.<br><br>
              <strong>Nawaloka Hospital</strong> · 23 Deshamanya H K Dharmadasa Mawatha, Colombo 02<br>
              Tel: 011 5577111
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _row(label: str, value: str) -> str:
    return f"""<tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:10px 14px;font-size:12px;font-weight:600;
                 color:#888;width:38%;background:#fafafa;">{label}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111;">{value}</td>
    </tr>"""


def send_password_reset(to_email: str, reset_link: str, patient_name: str) -> None:
    """Send a password reset email. Silently logs on failure."""
    settings = get_settings()
    if not settings.gmail_user or not settings.gmail_app_password:
        _log.warning("Email not configured — skipping password reset to %s", to_email)
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Reset your eChannelling password"
        msg["From"]    = f"eChannelling <{settings.gmail_user}>"
        msg["To"]      = to_email

        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;
             overflow:hidden;box-shadow:0 4px 24px rgba(0,48,135,.10);">
        <tr>
          <td style="background:linear-gradient(135deg,#003087 0%,#0057e7 100%);
                     padding:28px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:.3px;">eChannelling</div>
            <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px;">Nawaloka Hospital · Colombo</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;text-align:center;">
            <div style="font-size:36px;margin-bottom:12px;">🔐</div>
            <div style="font-size:20px;font-weight:700;color:#111;">Password Reset Request</div>
            <div style="font-size:13px;color:#555;margin-top:8px;line-height:1.6;">
              Hi {patient_name},<br>
              We received a request to reset your eChannelling password.<br>
              Click the button below to choose a new password.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;text-align:center;">
            <a href="{reset_link}"
               style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                      color:#fff;font-size:15px;font-weight:700;padding:14px 32px;
                      border-radius:10px;text-decoration:none;letter-spacing:.3px;">
              Reset Password
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;text-align:center;">
            <div style="font-size:12px;color:#888;line-height:1.6;">
              This link expires in <strong>1 hour</strong>.<br>
              If you didn't request a password reset, you can safely ignore this email.
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8faff;padding:14px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#999;">
              Nawaloka Hospital · 23 Deshamanya H K Dharmadasa Mawatha, Colombo 02 · 011 5577111
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

        msg.attach(MIMEText(
            f"Hi {patient_name},\n\nReset your eChannelling password using this link (expires in 1 hour):\n{reset_link}\n\nIf you didn't request this, ignore this email.",
            "plain",
        ))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.gmail_user, settings.gmail_app_password)
            server.sendmail(settings.gmail_user, to_email, msg.as_string())

        _log.info("Password reset email sent to %s", to_email)
    except Exception as exc:
        _log.error("Password reset email failed to %s: %s", to_email, exc)


def send_appointment_reminder(
    to_email: str,
    ref: str,
    doctor: str,
    date: str,
    time: str,
    appt_num: int,
    patient_name: str,
) -> None:
    """Send a 24-hour appointment reminder email."""
    settings = get_settings()
    if not settings.gmail_user or not settings.gmail_app_password:
        _log.warning("Email not configured — skipping reminder to %s", to_email)
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Reminder: Your appointment tomorrow — {ref}"
        msg["From"]    = f"eChannelling <{settings.gmail_user}>"
        msg["To"]      = to_email

        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;
             overflow:hidden;box-shadow:0 4px 24px rgba(0,48,135,.10);">
        <tr>
          <td style="background:linear-gradient(135deg,#003087 0%,#0057e7 100%);
                     padding:24px 32px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#fff;">eChannelling</div>
            <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:3px;">Nawaloka Hospital · Colombo</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 10px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🔔</div>
            <div style="font-size:20px;font-weight:700;color:#003087;">Appointment Tomorrow</div>
            <div style="font-size:13px;color:#555;margin-top:6px;">
              Hi {patient_name}, this is a reminder for your appointment at Nawaloka Hospital.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              {_row("Doctor", doctor)}
              {_row("Date", date)}
              {_row("Time", time)}
              {_row("Appointment #", str(appt_num))}
              {_row("Reference", ref)}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
              <tr><td style="padding:14px 16px;font-size:13px;color:#92400e;line-height:1.6;">
                ⏰ Please arrive <strong>15 minutes early</strong> and bring a valid ID.<br>
                📋 Reference number: <strong>{ref}</strong>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8faff;padding:14px 32px;text-align:center;
                     border-top:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#999;">
              Nawaloka Hospital · 23 Deshamanya H K Dharmadasa Mawatha, Colombo 02 · 011 5577111
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

        msg.attach(MIMEText(
            f"Reminder: You have an appointment tomorrow with {doctor} at {time}. Reference: {ref}",
            "plain",
        ))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.gmail_user, settings.gmail_app_password)
            server.sendmail(settings.gmail_user, to_email, msg.as_string())

        _log.info("Reminder sent to %s (ref=%s)", to_email, ref)
    except Exception as exc:
        _log.error("Reminder email failed to %s: %s", to_email, exc)


def send_booking_confirmation(
    to_email: str,
    ref: str,
    appt_num: int,
    doctor: str,
    hospital: str,
    date: str,
    time: str,
    patient_name: str,
    patient_phone: str,
    total_lkr: float,
) -> None:
    """Send HTML booking receipt. Silently logs on failure — never breaks booking flow."""
    settings = get_settings()
    if not settings.gmail_user or not settings.gmail_app_password:
        _log.warning("Email not configured — skipping confirmation to %s", to_email)
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Booking Confirmed — {ref} | {doctor}"
        msg["From"]    = f"eChannelling <{settings.gmail_user}>"
        msg["To"]      = to_email

        html = _html_receipt(ref, appt_num, doctor, hospital,
                             date, time, patient_name, patient_phone, total_lkr)
        msg.attach(MIMEText(
            f"Booking confirmed. Reference: {ref}. "
            f"Appointment #{appt_num} with {doctor} on {date} at {time}.",
            "plain",
        ))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.gmail_user, settings.gmail_app_password)
            server.sendmail(settings.gmail_user, to_email, msg.as_string())

        _log.info("Confirmation email sent to %s (ref=%s)", to_email, ref)
    except Exception as exc:
        _log.error("Email send failed to %s: %s", to_email, exc)


def send_lab_test_confirmation(
    to_email: str,
    ref: str,
    patient_name: str,
    tests: list[dict],
    total_lkr: float,
) -> None:
    """Send lab test booking confirmation email."""
    settings = get_settings()
    if not settings.gmail_user or not settings.gmail_app_password:
        _log.warning("Email not configured — skipping lab confirmation to %s", to_email)
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Lab Tests Booked — {ref}"
        msg["From"]    = f"eChannelling <{settings.gmail_user}>"
        msg["To"]      = to_email

        test_rows = "".join(
            _row(t["name"], f"Rs. {t['price']:,.0f}") for t in tests
        )
        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;
             overflow:hidden;box-shadow:0 4px 24px rgba(0,48,135,.10);">
        <tr>
          <td style="background:linear-gradient(135deg,#003087 0%,#0057e7 100%);
                     padding:28px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#fff;">eChannelling</div>
            <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px;">Nawaloka Hospital · Colombo</div>
          </td>
        </tr>
        <tr>
          <td style="background:#f0fdf4;padding:18px 32px;text-align:center;border-bottom:1px solid #d1fae5;">
            <div style="display:inline-block;background:#16a34a;border-radius:50%;
                        width:38px;height:38px;line-height:38px;text-align:center;
                        font-size:20px;color:#fff;margin-bottom:8px;">&#10003;</div>
            <div style="font-size:18px;font-weight:700;color:#15803d;">Lab Tests Booked</div>
            <div style="font-size:13px;color:#166534;margin-top:4px;">
              Your lab tests have been successfully scheduled.
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;text-align:center;">
            <div style="font-size:11px;font-weight:600;color:#888;letter-spacing:1px;
                        text-transform:uppercase;margin-bottom:6px;">Booking Reference</div>
            <div style="font-size:26px;font-weight:800;color:#003087;
                        font-family:monospace;letter-spacing:2px;">{ref}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;">
            <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;
                        text-transform:uppercase;letter-spacing:.5px;">Tests Ordered</div>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              {test_rows}
              {_row("Total", f"Rs. {total_lkr:,.0f}")}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
              <tr><td style="padding:14px 16px;font-size:13px;color:#92400e;line-height:1.6;">
                Please visit the <strong>Nawaloka Hospital Laboratory</strong> with this reference.<br>
                Reference: <strong>{ref}</strong><br>
                Open daily 6:00 AM - 9:00 PM
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8faff;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#999;line-height:1.6;">
              Nawaloka Hospital · 23 Deshamanya H K Dharmadasa Mawatha, Colombo 02<br>
              Tel: 011 5577111
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

        msg.attach(MIMEText(
            f"Lab tests booked. Reference: {ref}. "
            f"Visit Nawaloka Hospital Laboratory with this reference. Total: Rs. {total_lkr:,.0f}",
            "plain",
        ))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.gmail_user, settings.gmail_app_password)
            server.sendmail(settings.gmail_user, to_email, msg.as_string())

        _log.info("Lab confirmation email sent to %s (ref=%s)", to_email, ref)
    except Exception as exc:
        _log.error("Lab email send failed to %s: %s", to_email, exc)
