import Link from 'next/link'

export default function RegisterSuccessPage() {
  return (
    // Main background: Dark/Zinc
    <div className="flex flex-col items-center justify-center p-4 min-h-[80vh] bg-zinc-950">
      <main className="w-full flex flex-col items-center justify-center p-4">
        
        {/* Card box: Dark grey background with a thin orange accent border */}
        <div className="max-w-md w-full bg-zinc-900 p-8 rounded-lg shadow-2xl text-center border border-orange-500/30">
          
          {/* Checkmark Icon: Green background, white text, green glow */}
          <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-[0_0_15px_rgba(34,197,94,0.4)]">
            ✓
          </div>

          {/* Heading: White text */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Verification Successful!
          </h1>
          
          {/* Description: Light grey text for readability on dark background */}
          <p className="text-zinc-400 mb-8">
            Your account has been successfully verified. You can now proceed to the login page to access your account.
          </p>

          {/* Button: Orange background, white text, darkens on hover */}
          <Link 
            href="/login" 
            className="block w-full bg-orange-500 text-white font-semibold text-center py-2 px-4 rounded-md hover:bg-orange-600 transition-colors shadow-lg hover:shadow-orange-500/25"
          >
            Go to Login
          </Link>

        </div>
      </main>
    </div>
  )
}