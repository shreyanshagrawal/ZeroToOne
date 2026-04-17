import { useRepoStore } from '../../store/useRepoStore'

export default function LoadingOverlay() {
  const { isAnalyzing, analyzeStep, analyzeSteps } = useRepoStore()

  if (!isAnalyzing) return null

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center" style={{ background: '#0d0d0f' }}>

      {/* Subtle radial glow behind spinner */}
      <div
        className="absolute"
        style={{
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(107,79,216,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Spinner */}
      <div
        className="w-14 h-14 rounded-full border-2 loading-spin mb-6 relative z-10"
        style={{ borderColor: '#1e1e2e', borderTopColor: '#6b4fd8' }}
      />

      {/* Title */}
      <div className="text-center mb-6 relative z-10">
        <div className="text-[20px] font-semibold text-[#e0e0f0] tracking-tight">Analyzing Repository</div>
        <div className="text-[13px] text-[#5a5a72] mt-1.5">
          {analyzeSteps[Math.min(analyzeStep, analyzeSteps.length - 1)] ?? 'Please wait...'}
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-2.5 relative z-10">
        {analyzeSteps.map((step, i) => (
          <div key={step} className="flex items-center gap-3 text-[13px]">
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${
                i < analyzeStep
                  ? 'bg-[#4ade80]'
                  : i === analyzeStep
                  ? 'bg-[#6b4fd8] status-pulse'
                  : 'bg-[#252535]'
              }`}
            />
            <span
              className={`transition-colors duration-300 ${
                i < analyzeStep
                  ? 'text-[#4ade80]'
                  : i === analyzeStep
                  ? 'text-[#d0d0e8]'
                  : 'text-[#2e2e46]'
              }`}
            >
              {step}
            </span>
            {i < analyzeStep && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
