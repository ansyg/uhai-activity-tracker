import { AuthSplitScreen } from "@/components/auth/AuthSplitScreen";
import { SignInForm } from "@/components/auth/SignInForm";

export function LoginSplitScreen({ googleEnabled }: { googleEnabled: boolean }) {
  return (
    <AuthSplitScreen heading="Welcome back" subheading="Sign in to keep your trackers moving.">
      <SignInForm googleEnabled={googleEnabled} />
    </AuthSplitScreen>
  );
}
