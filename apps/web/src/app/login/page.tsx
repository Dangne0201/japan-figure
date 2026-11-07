import AuthForm from '../../components/auth-form';
import AuthPage from '../../components/auth-page';

export default function LoginPage() {
  return (
    <AuthPage
      title="Đăng nhập"
      description="Đăng nhập để quản lý tài khoản của bạn tại Japan Figure."
    >
      <AuthForm mode="login" />
    </AuthPage>
  );
}
