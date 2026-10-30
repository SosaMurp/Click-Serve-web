import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons'; 
import { api } from './context/AuthContext'; 

export default function VerifyScreen() {
  const router = useRouter();
  const { userEmail } = useLocalSearchParams(); 
  
  // Ahora el código es un solo string simple, no un arreglo
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 
  const [isResending, setIsResending] = useState(false); 

  const handleCodeChange = (text: string) => {
    // Solo permitimos números
    const cleaned = text.replace(/[^0-9]/g, '');
    setCode(cleaned);
    setError(false); 
    if (cleaned.length === 4) {
      handleVerify(cleaned);
    }
  };

  const handleVerify = async (codeToVerify?: any) => {
    const activeCode = typeof codeToVerify === 'string' ? codeToVerify : code;
    // Como ahora es un solo string, ya no necesitamos hacer el .join()
    if (activeCode.length < 4) {
      setError(true);
      return;
    }

    setIsLoading(true);
    setError(false);

    try {
      const response = await api.post('/api/verify-token', { email: userEmail, token: activeCode });
      const data = response.data;

      setIsLoading(false);
      setSuccess(true); 
      setTimeout(() => {
        router.replace('/'); 
      }, 2500);

    } catch (err: any) {
      setIsLoading(false);
      setError(true); 
      console.error(err);
      const errMsg = err.response?.data?.error || 'No se pudo conectar con el servidor.';
      Alert.alert('Error de conexión', errMsg);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    try {
      const response = await api.post('/api/resend-code', { email: userEmail });
      const data = response.data;

      Alert.alert('¡Código enviado!', 'Revisa tu bandeja de entrada. Los códigos anteriores ya no funcionarán.');
      setCode(''); // Vaciamos el input completo de un solo golpe
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'No pudimos comunicarnos con el servidor.';
      Alert.alert('Error de conexión', errMsg);
    } finally {
      setIsResending(false);
    }
  };

  // Función auxiliar para dibujar cada cajita visual
  const renderCodeBox = (index: number) => {
    // Extraemos la letra que corresponde a esta cajita, o dejamos vacío
    const digit = code[index] || ''; 
    return (
      <View key={index} style={[styles.otpBox, error && styles.otpBoxError]}>
        <Text style={styles.otpText}>{digit}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        
        <View style={styles.iconContainer}>
          <Feather name="mail" size={28} color="#7A8C9E" />
        </View>

        <Text style={styles.title}>Verifica tu correo</Text>
        <Text style={styles.subtitle}>
          Hemos enviado un código de 4 dígitos a{'\n'}
          <Text style={styles.boldEmail}>{userEmail ? userEmail : 'tu correo'}</Text>
        </Text>

        <View style={styles.card}>
          
          {success ? (
            <View style={styles.successContainer}>
              <Feather name="check-circle" size={50} color="#28A745" style={{ marginBottom: 15 }} />
              <Text style={styles.successText}>¡Código válido!</Text>
              <Text style={styles.successSubtext}>Redirigiendo a Inicio de Sesión...</Text>
              <ActivityIndicator size="large" color="#0A192F" style={{ marginTop: 20 }} />
            </View>
          ) : (
            <>
              {/* Contenedor principal del OTP */}
              <View style={styles.otpContainer}>
                
                {/* 1. Las 4 cajitas visuales dibujadas dinámicamente */}
                {[0, 1, 2, 3].map(renderCodeBox)}

                {/* 2. El Input Fantasma (ocupa todo el espacio por encima de las cajitas pero es transparente) */}
                <TextInput
                  style={styles.hiddenInput}
                  value={code}
                  onChangeText={handleCodeChange}
                  keyboardType="number-pad"
                  maxLength={4}
                  caretHidden={true} // Oculta la barrita parpadeante
                  autoFocus={true}
                />
              </View>

              {error && <Text style={styles.errorText}>Código inválido o expirado.</Text>}

              <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={isLoading || isResending}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>VERIFICAR CÓDIGO</Text>
                )}
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                <Text style={styles.resendTextSub}>¿NO RECIBISTE NADA?</Text>
                <TouchableOpacity onPress={handleResendCode} disabled={isResending}>
                  {isResending ? (
                    <Text style={[styles.resendTextMain, { color: '#7A8C9E' }]}>Enviando código...</Text>
                  ) : (
                    <Text style={styles.resendTextMain}>Reenviar Código</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>

        {!success && (
          <TouchableOpacity style={styles.backContainer} onPress={() => router.back()}>
            <Text style={styles.backText}>← VOLVER AL REGISTRO</Text>
          </TouchableOpacity>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  iconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '700', color: '#0A192F', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#7A8C9E', textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  boldEmail: { fontWeight: 'bold', color: '#0A192F', fontStyle: 'italic' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 30, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 30 },
  
  // ESTILOS NUEVOS PARA EL OTP FANTASMA
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, position: 'relative' },
  otpBox: { borderBottomWidth: 2, borderBottomColor: '#D1D9E0', width: '20%', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  otpBoxError: { borderBottomColor: '#D9534F' },
  otpText: { fontSize: 24, color: '#0A192F', fontWeight: 'bold' },
  hiddenInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0 }, // Magia pura
  
  errorText: { color: '#D9534F', fontSize: 12, textAlign: 'center', marginBottom: 15, fontWeight: 'bold' },
  button: { backgroundColor: '#0A192F', paddingVertical: 16, borderRadius: 2, alignItems: 'center', marginTop: 10, marginBottom: 25 },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
  resendContainer: { alignItems: 'center' },
  resendTextSub: { color: '#B0BEC5', fontSize: 11, letterSpacing: 1, fontWeight: 'bold', marginBottom: 5 },
  resendTextMain: { color: '#0A192F', fontSize: 14, fontWeight: 'bold' },
  backContainer: { marginTop: 10 },
  backText: { color: '#9CA8B6', fontSize: 12, letterSpacing: 1, fontWeight: '600' },
  successContainer: { alignItems: 'center', paddingVertical: 20 },
  successText: { fontSize: 22, fontWeight: 'bold', color: '#28A745', marginBottom: 5 },
  successSubtext: { fontSize: 14, color: '#7A8C9E' }
});