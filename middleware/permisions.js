const restrictTo = (...roles) => {
  return (req, res, next) => {
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const hasPermission = roles.some(role => userRoles.includes(role));
    
    if (!hasPermission) {
      return AppError(res, 403, false, 'anauthorized: Only admins or managers can update credits');
    }
    next();
  };
};
export { restrictTo  };