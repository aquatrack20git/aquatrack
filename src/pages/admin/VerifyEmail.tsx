import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Alert, Button, Card, Spinner } from '../../components/ui';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Extraer el token o código de la URL
        const token = searchParams.get('token');
        const code = searchParams.get('code');
        const type = searchParams.get('type');

        console.log('Parámetros de verificación:', { token, code, type });

        if (!token && !code) {
          throw new Error('No se encontró token de verificación');
        }

        // Verificar el email usando el token o código
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token || code || '',
          type: 'email',
        });

        if (error) {
          console.error('Error en verificación:', error);
          throw error;
        }

        if (!data.user) {
          throw new Error('No se pudo obtener la información del usuario');
        }

        // Actualizar el estado del usuario en la tabla users
        const { error: updateError } = await supabase
          .from('users')
          .update({ status: 'active' })
          .eq('id', data.user.id);

        if (updateError) {
          console.error('Error al actualizar estado:', updateError);
          throw new Error('Error al actualizar el estado del usuario');
        }

        setEmail(data.user.email || '');
        setVerificationStatus('success');
      } catch (error: any) {
        console.error('Error completo en verificación:', error);
        setVerificationStatus('error');
        
        if (error.message.includes('expired')) {
          setErrorMessage('El enlace de verificación ha expirado. Por favor, solicita un nuevo enlace.');
        } else if (error.message.includes('invalid')) {
          setErrorMessage('El enlace de verificación es inválido. Por favor, solicita un nuevo enlace.');
        } else {
          setErrorMessage('Error al verificar el email. Por favor, intenta nuevamente.');
        }
      }
    };

    verifyEmail();
  }, [searchParams]);

  const handleResendConfirmation = async () => {
    try {
      if (!email) {
        throw new Error('No hay email disponible para reenviar la confirmación');
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/verify-email`
        }
      });

      if (error) throw error;

      setErrorMessage('Se ha enviado un nuevo enlace de verificación a tu correo electrónico.');
    } catch (error: any) {
      console.error('Error al reenviar confirmación:', error);
      setErrorMessage('Error al reenviar el enlace de verificación. Por favor, intenta nuevamente.');
    }
  };

  if (verificationStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="lg" />
            <p className="text-gray-600">Verificando tu email...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        {verificationStatus === 'success' ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-green-800">¡Email verificado exitosamente!</h2>
              <p className="text-green-700 mt-2">
                Tu cuenta ha sido verificada. Ahora puedes iniciar sesión.
              </p>
            </div>
            <Button
              onClick={() => navigate('/admin/login')}
              className="w-full"
            >
              Ir al inicio de sesión
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert
              variant="error"
              title="Error en la verificación"
              message={errorMessage}
            />
            {email && (
              <Button
                onClick={handleResendConfirmation}
                variant="outline"
                className="w-full"
              >
                Reenviar enlace de verificación
              </Button>
            )}
            <Button
              onClick={() => navigate('/admin/login')}
              className="w-full"
            >
              Volver al inicio de sesión
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
} 