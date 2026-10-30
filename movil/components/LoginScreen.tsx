import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, api } from './context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Para mostrar que está cargando
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert('Error', 'Por favor ingresa tu correo y contraseña.');
    return;
  }

  setIsLoading(true);

  try {
    const response = await api.post('/api/login', { email, password });
    const data = response.data;

    setIsLoading(false);
    
    Alert.alert(
      'Éxito', 
      'Inicio de sesión correcto', 
      [
        { 
          text: 'OK', 
          onPress: () => {
            // Llamamos a la función login del contexto.
            // Le pasamos el token real que el backend retorna en data.token
            login(data.usuario, data.token);
          } 
        }
      ]
    );

  } catch (error: any) {
    setIsLoading(false);
    console.error(error);
    const errMessage = error.response?.data?.error || 'Credenciales incorrectas o problemas de conexión.';
    Alert.alert('Error de Inicio de Sesión', errMessage);
  }
};

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Click & Serve</Text>
          <Text style={styles.subtitle}>LÁZARO CÁRDENAS</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(text) => { setEmail(text); setErrorMessage(''); }}
            selectionColor="#001b3a"
          />

          <Text style={styles.label}>CONTRASEÑA</Text>
          <TextInput
            style={styles.input}
            placeholder="********"
            secureTextEntry
            value={password}
            onChangeText={(text) => { setPassword(text); setErrorMessage(''); }}
            selectionColor="#001b3a"
          />

          <TouchableOpacity style={styles.forgotContainer} onPress={() => router.push('/request-recovery' as any)}>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerContainer} onPress={() => router.push('/register')}>
            <Text style={styles.registerText}>¿No tienes cuenta? Crea una aquí</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ... Mantén exactamente los mismos estilos que ya tenías abajo, solo agrega este para el error y botón deshabilitado:
const styles = StyleSheet.create({
  // Pega tus estilos anteriores aquí (safeArea, container, title, etc)
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 36, fontWeight: '700', color: '#0A192F', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontWeight: '600', color: '#7A8C9E', letterSpacing: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  label: { fontSize: 11, color: '#5B708B', fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 10 },
  input: { borderBottomWidth: 1, borderBottomColor: '#D1D9E0', fontSize: 16, paddingVertical: 10, color: '#0A192F', marginBottom: 10 },
  forgotContainer: { alignItems: 'flex-end', marginBottom: 30 },
  forgotText: { color: '#7A8C9E', fontSize: 12 },
  button: { backgroundColor: '#0A192F', paddingVertical: 16, borderRadius: 2, alignItems: 'center', marginBottom: 20 },
  buttonDisabled: { backgroundColor: '#5B708B' }, // Color para cuando está cargando
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  registerContainer: { alignItems: 'center', marginTop: 10 },
  registerText: { color: '#7A8C9E', fontSize: 14, fontWeight: '500' },
  errorText: { color: '#D9534F', fontSize: 13, textAlign: 'center', marginBottom: 15, fontWeight: 'bold' }
});