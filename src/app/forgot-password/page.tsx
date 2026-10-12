import { AuthSplitScreen } from "@/components/auth/AuthSplitScreen";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthSplitScreen>
      <ForgotPasswordForm />
    </AuthSplitScreen>
  );
}
