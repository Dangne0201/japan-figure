import AuthForm from '../../components/auth-form';
import AuthPage from '../../components/auth-page';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthPage
      title="Đặt lại mật khẩu"
      description="Tạo mật khẩu mới bằng liên kết được gửi đến Mailpit."
    >
      <AuthForm mode="reset" token={token} />
    </AuthPage>
  );
}
