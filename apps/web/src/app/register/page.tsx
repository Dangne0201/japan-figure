import AuthForm from '../../components/auth-form';
import AuthPage from '../../components/auth-page';

export default function RegisterPage() {
  return (
    <AuthPage
      title="Tạo tài khoản"
      description="Tài khoản chỉ dùng trong bản mô phỏng học tập. Email xác minh được gửi vào Mailpit."
    >
      <AuthForm mode="register" />
    </AuthPage>
  );
}
