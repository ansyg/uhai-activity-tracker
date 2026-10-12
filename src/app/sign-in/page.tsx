import { isGoogleSignInConfigured } from "@/lib/auth/google-config";
import { LoginSplitScreen } from "@/components/auth/LoginSplitScreen";

export default function SignInPage() {
  return <LoginSplitScreen googleEnabled={isGoogleSignInConfigured()} />;
}
