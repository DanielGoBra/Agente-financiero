import React, { useState } from "react";
import { motion } from "motion/react";
import { authService, databaseService } from "../lib/supabase";
import { UserProfile } from "../types";
import { 
  KeyRound, Mail, ArrowRight, Loader2, AlertCircle
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
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-ink-500/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-sky-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-gold-400/5 rounded-full blur-[100px] pointer-events-none" />
      
      <motion.div
        className="w-full max-w-[440px] z-10 flex flex-col gap-7"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        
        {/* Logo / Header Branding */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="inline-flex p-3.5 bg-dark-2/60 border border-white/8 rounded-2xl mb-4 shadow-glow-teal">
            <img
              src="/logo-pymes.svg"
              alt="Localizador PYMEs"
              className="w-9 h-9 drop-shadow-lg"
            />
          </div>
          <motion.h2
            className="text-[10px] uppercase font-bold tracking-[0.2em] text-ink-400 mb-1.5 font-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Plataforma de Prospección Comercial
          </motion.h2>
          <motion.h1
            className="text-3xl font-bold text-white tracking-tight font-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            Localizador <span className="text-ink-400 font-display italic font-normal">PYMEs</span>
          </motion.h1>
        </motion.div>

        {/* Main Card — Glass Dark */}
        <motion.div
          className="glass-dark rounded-3xl p-7 md:p-9 shadow-heavy"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          
          <h3 className="text-lg font-bold text-white mb-7 text-center tracking-tight">
            Iniciar Sesión
          </h3>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            <motion.div
              className="space-y-1.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-body">Correo Electrónico</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-3.5 text-slate-500 group-focus-within:text-ink-400 transition-colors" size={15} />
                <input
                  type="email"
                  required
                  placeholder="asesor@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-dark-0/60 border border-slate-800/80 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-ink-500/30 focus:border-ink-600 transition-all font-medium font-body"
                />
              </div>
            </motion.div>

            <motion.div
              className="space-y-1.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-body">Contraseña</label>
              <div className="relative group">
                <KeyRound className="absolute left-3.5 top-3.5 text-slate-500 group-focus-within:text-ink-400 transition-colors" size={15} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-dark-0/60 border border-slate-800/80 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-ink-500/30 focus:border-ink-600 transition-all font-medium font-body"
                />
              </div>
            </motion.div>

            {errorMsg && (
              <motion.div
                className="bg-rose-950/40 border border-rose-900/30 p-3.5 rounded-xl text-rose-300 text-[11px] leading-relaxed flex items-start gap-2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="font-body">{errorMsg}</span>
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-ink-700 to-ink-600 hover:from-ink-600 hover:to-ink-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-ink-900/30 text-xs uppercase tracking-wider disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed btn-shimmer font-body"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                  Procesando...
                </>
              ) : (
                <>
                  Acceder a la plataforma
                  <ArrowRight size={13} />
                </>
              )}
            </motion.button>

          </form>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="text-center text-[10px] text-slate-500/80 leading-relaxed font-body"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Protegido mediante políticas RLS y cifrado de extremo a extremo.<br />
          © {new Date().getFullYear()} Localizador PYMEs. Todos los derechos reservados.
        </motion.p>

      </motion.div>
    </div>
  );
}
