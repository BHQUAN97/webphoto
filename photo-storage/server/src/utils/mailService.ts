import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export type MailTemplate =
  | 'order_new' | 'order_customer_confirm' | 'order_paid'
  | 'order_failed' | 'order_reminder' | 'register_welcome'
  | 'reset_password' | 'storage_warning' | 'system_restart'

export interface MailPayload {
  to:       string | string[]
  template: MailTemplate
  data:     Record<string, unknown>
}

function formatVnd(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
}

function wrapLayout(content: string, title: string): string {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">
  <div style="border-bottom:3px solid #f97316;padding-bottom:16px;margin-bottom:24px">
    <strong style="font-size:20px">${process.env.APP_NAME}</strong>
  </div>
  ${content}
  <div style="border-top:1px solid #e5e7eb;margin-top:32px;padding-top:16px;color:#9ca3af;font-size:12px">
    <p>${process.env.APP_NAME} · ${process.env.APP_ADDRESS ?? ''}</p>
    <p>Zalo: ${process.env.SUPPORT_PHONE} · Email: ${process.env.SUPPORT_EMAIL}</p>
  </div>
</body></html>`
}

const templates: Record<MailTemplate, (d: Record<string, unknown>) => { subject: string; html: string }> = {
  order_new: (d) => ({
    subject: `[Đơn mới] #${d.orderId} — ${formatVnd(d.amountVnd as number)}`,
    html: `<h2>Có đơn hàng mới</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 12px 6px 0"><b>Mã đơn</b></td><td>#${d.orderId}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Khách hàng</b></td><td>${d.customerName} — ${d.customerEmail}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Sản phẩm</b></td><td>${d.planName}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Số tiền</b></td><td>${formatVnd(d.amountVnd as number)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Nội dung CK</b></td><td>${d.referenceCode}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Phương thức</b></td><td>${d.methodName}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Thời gian</b></td><td>${d.createdAt}</td></tr>
      </table>
      <p style="margin-top:20px"><a href="${process.env.APP_URL}/admin/payments/${d.paymentId}"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Xem đơn hàng
      </a></p>`,
  }),

  order_customer_confirm: (d) => ({
    subject: `[Xác nhận CK] #${d.orderId} — ${d.customerName} báo đã chuyển`,
    html: `<h2>Khách hàng xác nhận đã chuyển khoản</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 12px 6px 0"><b>Mã đơn</b></td><td>#${d.orderId}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Khách hàng</b></td><td>${d.customerName} — ${d.customerEmail}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Số tiền</b></td><td>${formatVnd(d.amountVnd as number)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Nội dung CK</b></td><td>${d.referenceCode}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Ghi chú KH</b></td><td>${d.customerNote || '(không có)'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Thời gian XN</b></td><td>${d.confirmedAt}</td></tr>
      </table>
      <p style="margin-top:20px">
        <a href="${process.env.APP_URL}/admin/payments/${d.paymentId}?action=approve"
          style="background:#16a34a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
          Duyệt thanh toán
        </a>
        <a href="${process.env.APP_URL}/admin/payments/${d.paymentId}?action=reject"
          style="background:#dc2626;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px;margin-left:12px">
          Từ chối
        </a>
      </p>`,
  }),

  order_paid: (d) => ({
    subject: `Thanh toán thành công — Đơn hàng #${d.orderId}`,
    html: `<h2>Cảm ơn bạn đã mua hàng!</h2>
      <p>Đơn hàng <b>#${d.orderId}</b> đã được xác nhận thanh toán.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 12px 6px 0"><b>Sản phẩm</b></td><td>${d.planName}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Hiệu lực từ</b></td><td>${d.startedAt}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Hết hạn</b></td><td>${d.expiresAt}</td></tr>
      </table>
      ${d.deliveryInfo ? `<h3>Thông tin tài khoản</h3>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;font-family:monospace;font-size:14px;white-space:pre-line">
        ${d.deliveryInfo}
      </div>` : ''}
      <p style="color:#6b7280;font-size:13px;margin-top:24px">
        Cần hỗ trợ? Liên hệ Zalo: ${process.env.SUPPORT_PHONE}
      </p>`,
  }),

  order_failed: (d) => ({
    subject: `Đơn hàng #${d.orderId} không thành công`,
    html: `<h2>Đơn hàng không được xác nhận</h2>
      <p>Rất tiếc, đơn hàng <b>#${d.orderId}</b> của bạn không thể xử lý.</p>
      ${d.adminNote ? `<p><b>Lý do:</b> ${d.adminNote}</p>` : ''}
      <p>Liên hệ để được hỗ trợ:</p>
      <ul style="font-size:14px"><li>Zalo: ${process.env.SUPPORT_PHONE}</li><li>Email: ${process.env.SUPPORT_EMAIL}</li></ul>
      <a href="${process.env.APP_URL}/upgrade"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Thử lại
      </a>`,
  }),

  order_reminder: (d) => ({
    subject: `Nhắc nhở: Đơn #${d.orderId} chưa thanh toán — còn ${d.hoursLeft}h`,
    html: `<h2>Đơn hàng của bạn đang chờ thanh toán</h2>
      <p>Đơn <b>#${d.orderId}</b> — <b>${formatVnd(d.amountVnd as number)}</b> sẽ hết hạn sau <b>${d.hoursLeft} giờ</b>.</p>
      <p>Chuyển khoản với nội dung: <b>${d.referenceCode}</b></p>
      <a href="${process.env.APP_URL}/orders/${d.paymentId}"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Xem chi tiết đơn hàng
      </a>`,
  }),

  register_welcome: (d) => ({
    subject: `Chào mừng ${d.displayName} đến với ${process.env.APP_NAME}!`,
    html: `<h2>Xin chào ${d.displayName}!</h2>
      <p>Tài khoản của bạn đã được tạo thành công.</p>
      <a href="${process.env.APP_URL}/dashboard"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Bắt đầu ngay
      </a>`,
  }),

  reset_password: (d) => ({
    subject: 'Đặt lại mật khẩu',
    html: `<h2>Đặt lại mật khẩu</h2>
      <p>Link có hiệu lực trong 30 phút:</p>
      <a href="${d.resetUrl}"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Đặt lại mật khẩu
      </a>
      <p style="color:#6b7280;font-size:13px;margin-top:16px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
  }),

  storage_warning: (d) => ({
    subject: `Cảnh báo: Dung lượng lưu trữ còn ${d.remainPercent}%`,
    html: `<h2>Dung lượng sắp đầy</h2>
      <p>Bạn đã dùng <b>${d.usedGB}GB / ${d.limitGB}GB</b> (${100 - (d.remainPercent as number)}%).</p>
      <a href="${process.env.APP_URL}/upgrade"
        style="background:#f97316;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px">
        Nâng cấp dung lượng
      </a>`,
  }),

  system_restart: (d) => ({
    subject: `[Hệ thống] Server đã khởi động lại — ${d.timestamp}`,
    html: `<h2>Hệ thống đã khởi động lại</h2>
      <p>Server API đã khởi động thành công.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 12px 6px 0"><b>Thời gian</b></td><td>${d.timestamp}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Node version</b></td><td>${d.nodeVersion}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Port</b></td><td>${d.port}</td></tr>
        <tr><td style="padding:6px 12px 6px 0"><b>Storage backend</b></td><td>${d.storageBackend}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;margin-top:24px">
        Đây là email tự động thông báo server đã khởi động lại thành công.
      </p>`,
  }),
}

export const mailService = {
  async send({ to, template, data }: MailPayload): Promise<void> {
    const builder = templates[template]
    if (!builder) throw new Error(`Unknown mail template: ${template}`)
    const { subject, html } = builder(data)
    await resend.emails.send({
      from: `${process.env.APP_NAME} <${process.env.FROM_EMAIL}>`,
      to:   Array.isArray(to) ? to : [to],
      subject,
      html: wrapLayout(html, subject),
    })
  },

  async sendToAdmins(template: MailTemplate, data: Record<string, unknown>): Promise<void> {
    const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
    if (!adminEmails.length) return
    await this.send({ to: adminEmails, template, data })
  },
}
