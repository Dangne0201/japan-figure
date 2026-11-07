import AuthForm from '../../../components/auth-form';
import AuthPage from '../../../components/auth-page';

export default function ResendVerificationPage() {
  return (
    <AuthPage
      title="Gửi lại email xác minh"
      description="Nhập email đã đăng ký. Hệ thống không tiết lộ liệu email có thuộc tài khoản hay không."
    >
      <AuthForm mode="resend" />
    </AuthPage>
  );
}
