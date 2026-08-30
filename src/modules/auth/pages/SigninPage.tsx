import { landingFromParams } from '@/modules/auth/signin/machine'
import { DoorScene } from '@/modules/auth/signin/scenes'
import { useLocation } from 'react-router-dom'

/**
 * Signin. Picks the scene, reads why the visitor was bounced here, and hands
 * both to a scene that renders the one shared card.
 */
export const SigninPage = () => {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  const landing = landingFromParams(params)

  // return <StillLifeScene landing={landing} />
  // return <LedgerScene landing={landing} />
  return <DoorScene landing={landing} />
}
