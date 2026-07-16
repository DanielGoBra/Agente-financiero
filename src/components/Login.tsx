import React, { useState } from "react";
import { motion } from "motion/react";
import { authService, databaseService } from "../lib/supabase";
import { UserProfile } from "../types";
import { 
  KeyRound, Mail, ArrowRight, Loader2, AlertCircle, ShieldAlert
} from "lucide-react";

interface LoginProps {
  onAuthSuccess: (user: UserProfile) => void;
}

export function Login({ onAuthSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Por favor, completa todos los campos.");
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const { user, error } = await authService.signIn(email, password);
      if (error) {
        setErrorMsg(error);
      } else if (user) {
        // Log activity
        await databaseService.logActivity(user.id, user.email, "LOGIN", "Inicio de sesión exitoso");
        onAuthSuccess(user);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Ocurrió un error inesperado al conectar con el servicio de autenticación.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-animated flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-body">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none mix-blend-screen" />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-amber-400/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
      
      {/* Grid Pattern Overlay for Texture */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"></div>

      <motion.div
        className="w-full max-w-[480px] z-10 flex flex-col gap-8 relative"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        
        {/* Main Card — Ultra Premium Glass */}
        <div className="relative group">
          {/* Subtle glow behind the card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/20 to-blue-500/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-75 transition duration-1000"></div>
          
          <div className="relative bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-8 md:p-12 shadow-2xl overflow-hidden">
            
            {/* Inner subtle glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-teal-500/10 blur-[50px] pointer-events-none"></div>

            {/* Logo / Header Branding */}
            <motion.div
              className="text-center mb-10 relative z-10"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="inline-flex p-4 bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-2xl mb-6 shadow-inner relative overflow-hidden group-hover:border-teal-500/30 transition-colors duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <img
                  src="/logo-pymes.svg"
                  alt="Localizador PYMEs"
                  className="w-12 h-12 drop-shadow-xl relative z-10"
                />
              </div>
              <motion.h2
                className="text-[11px] uppercase font-bold tracking-[0.25em] text-teal-400 mb-2 font-body"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Plataforma de Prospección Comercial
              </motion.h2>
              <motion.h1
                className="text-3xl md:text-4xl font-bold text-white tracking-tight font-display"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Localizador <span className="text-teal-400 italic font-light">PYMEs</span>
              </motion.h1>
              <motion.p
                className="text-slate-400 text-sm mt-3 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Bienvenido de vuelta. Ingresa tus credenciales.
              </motion.p>
            </motion.div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="relative group/input">
                  <Mail className="absolute left-4 top-4 text-slate-500 group-focus-within/input:text-teal-400 transition-colors duration-300" size={18} />
                  <input
                    type="email"
                    required
                    placeholder=" "
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="peer w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition-all font-medium font-body"
                  />
                  <label className="absolute left-12 top-4 text-sm text-slate-500 font-medium transition-all duration-300 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:-top-2.5 peer-focus:text-[11px] peer-focus:text-teal-400 peer-focus:bg-slate-900 peer-focus:px-2 peer-valid:-top-2.5 peer-valid:text-[11px] peer-valid:text-slate-400 peer-valid:bg-slate-900 peer-valid:px-2 rounded-md pointer-events-none">
                    Correo Electrónico
                  </label>
                </div>
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <div className="relative group/input">
                  <KeyRound className="absolute left-4 top-4 text-slate-500 group-focus-within/input:text-teal-400 transition-colors duration-300" size={18} />
                  <input
                    type="password"
                    required
                    placeholder=" "
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="peer w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition-all font-medium font-body"
                  />
                   <label className="absolute left-12 top-4 text-sm text-slate-500 font-medium transition-all duration-300 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:-top-2.5 peer-focus:text-[11px] peer-focus:text-teal-400 peer-focus:bg-slate-900 peer-focus:px-2 peer-valid:-top-2.5 peer-valid:text-[11px] peer-valid:text-slate-400 peer-valid:bg-slate-900 peer-valid:px-2 rounded-md pointer-events-none">
                    Contraseña
                  </label>
                </div>
              </motion.div>

              {errorMsg && (
                <motion.div
                  className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-rose-300 text-xs leading-relaxed flex items-start gap-3 backdrop-blur-md"
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                >
                  <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <span className="font-body font-medium">{errorMsg}</span>
                </motion.div>
              )}

              <motion.button
                type="submit"
                disabled={isLoading}
                className="w-full relative overflow-hidden bg-gradient-to-r from-teal-600 to-teal-400 hover:from-teal-500 hover:to-teal-300 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:shadow-[0_0_30px_rgba(20,184,166,0.5)] text-sm tracking-wide disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none group/btn mt-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-teal-100" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Acceder a la plataforma</span>
                    <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform duration-300" />
                  </>
                )}
              </motion.button>

            </form>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          className="text-center space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <div className="flex items-center justify-center gap-2 text-slate-500/80 text-xs font-medium">
            <ShieldAlert size={12} />
            <span>Conexión protegida con TLS y controles de acceso</span>
          </div>
          <p className="text-[10px] text-slate-600 font-body">
            © {new Date().getFullYear()} Localizador PYMEs. Todos los derechos reservados.
          </p>
        </motion.div>

      </motion.div>
    </div>
  );
}
