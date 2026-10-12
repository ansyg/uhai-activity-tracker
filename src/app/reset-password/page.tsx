import { AuthSplitScreen } from "@/components/auth/AuthSplitScreen";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthSplitScreen>
      <ResetPasswordForm />
    </AuthSplitScreen>
  );
}
