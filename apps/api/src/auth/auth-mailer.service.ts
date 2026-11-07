import { Inject, Injectable } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfig } from '../config/env';

@Injectable()
export class AuthMailerService {
  private readonly transporter: Transporter;

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: false,
    });
  }

  async sendVerification(email: string, name: string, token: string): Promise<void> {
    const url = new URL('/verify-email', this.config.WEB_ORIGIN);
    url.searchParams.set('token', token);
    await this.transporter.sendMail({
      from: this.config.MAIL_FROM,
      to: email,
      subject: 'Xác minh email Japan Figure',
      text: `Chào ${name},\n\nXác minh email tại: ${url.toString()}\nLiên kết hết hạn sau ${this.config.AUTH_ACTION_TOKEN_TTL_HOURS} giờ.`,
    });
  }

  async sendPasswordReset(email: string, name: string, token: string): Promise<void> {
    const url = new URL('/reset-password', this.config.WEB_ORIGIN);
    url.searchParams.set('token', token);
    await this.transporter.sendMail({
      from: this.config.MAIL_FROM,
      to: email,
      subject: 'Đặt lại mật khẩu Japan Figure',
      text: `Chào ${name},\n\nĐặt lại mật khẩu tại: ${url.toString()}\nLiên kết hết hạn sau ${this.config.AUTH_ACTION_TOKEN_TTL_HOURS} giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    });
  }
}
