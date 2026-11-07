import AuthForm from '../../components/auth-form';
import AuthPage from '../../components/auth-page';

export default function ForgotPasswordPage() {
  return (
    <AuthPage
      title="Quên mật khẩu"
      description="Nhập email tài khoản. Nếu tồn tại, hướng dẫn đặt lại mật khẩu sẽ xuất hiện trong Mailpit."
    >
      <AuthForm mode="forgot" />
    </AuthPage>
  );
}
