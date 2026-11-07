import AccountProfile from '../../components/account-profile';
import AuthPage from '../../components/auth-page';

export default function AccountPage() {
  return (
    <AuthPage title="Tài khoản của tôi" description="Xem và cập nhật thông tin tài khoản.">
      <AccountProfile />
    </AuthPage>
  );
}
