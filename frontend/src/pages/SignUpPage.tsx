import { SignUp } from '@clerk/clerk-react'

export default function SignUpPage() {
  return (
    <div className="centered">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
    </div>
  )
}
