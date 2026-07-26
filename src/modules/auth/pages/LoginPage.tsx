import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@/modules/auth/components/LoginForm'

export const LoginPage = () => {
  const navigate = useNavigate()
  return <LoginForm onSuccess={() => navigate('/dashboard', { replace: true })} />
}
