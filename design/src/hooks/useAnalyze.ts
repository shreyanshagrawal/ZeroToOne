import { useRepoStore } from '../store/useRepoStore'
import { useNavigate } from 'react-router-dom'

export function useAnalyze() {
  const { analyzeRepo } = useRepoStore()
  const navigate = useNavigate()

  async function analyze(url: string) {
    if (!url.trim()) return
    await analyzeRepo(url.trim())
    navigate('/explore')
  }

  return { analyze }
}
