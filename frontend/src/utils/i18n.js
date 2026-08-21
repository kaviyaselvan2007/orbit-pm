const translations = {
  'English (US)': {},
  'English (UK)': {},
  'Spanish': {
    'Dashboard': 'Panel de control',
    'Notifications': 'Notificaciones',
    'Manage': 'Gestionar',
    'Projects': 'Proyectos',
    'Outcomes': 'Resultados',
    'Employees': 'Empleados',
    'Clients': 'Clientes',
    'Intelligence': 'Inteligencia',
    'Risk Prediction': 'Predicción de riesgo',
    'Effort Tracking': 'Seguimiento del esfuerzo',
    'AI Assistant': 'Asistente IA',
    'Reports': 'Informes',
    'Account': 'Cuenta',
    'Profile': 'Perfil',
    'Settings': 'Configuración',
    'Notification Center': 'Centro de notificaciones',
    'AI Risk Prediction': 'Predicción de riesgos de IA',
    'AI Project Assistant': 'Asistente de proyecto de IA',
    'My Profile': 'Mi perfil',
    'Logout': 'Cerrar sesión',
    'ORBITPM': 'ORBITPM'
  },
  'French': {
    'Dashboard': 'Tableau de bord',
    'Notifications': 'Notifications',
    'Manage': 'Gérer',
    'Projects': 'Projets',
    'Outcomes': 'Résultats',
    'Employees': 'Employés',
    'Clients': 'Clients',
    'Intelligence': 'Intelligence',
    'Risk Prediction': 'Prédiction des risques',
    'Effort Tracking': 'Suivi de l\'effort',
    'AI Assistant': 'Assistant IA',
    'Reports': 'Rapports',
    'Account': 'Compte',
    'Profile': 'Profil',
    'Settings': 'Paramètres',
    'Notification Center': 'Centre de notifications',
    'AI Risk Prediction': 'Prédiction des risques IA',
    'AI Project Assistant': 'Assistant de projet IA',
    'My Profile': 'Mon profil',
    'Logout': 'Se déconnecter',
    'ORBITPM': 'ORBITPM'
  }
};

export function t(key, lang = 'English (US)') {
  if (translations[lang] && translations[lang][key]) {
    return translations[lang][key];
  }
  return key;
}
