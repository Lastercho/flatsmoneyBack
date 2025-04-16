exports.checkBuildingAccess = async (req, res, next) => {
  try {
    const buildingId = req.params.buildingId;
    const hasAccess = await pool.query(
      'SELECT check_building_access($1, $2) as has_access',
      [req.user.id, buildingId]
    );

    if (!hasAccess.rows[0].has_access) {
      return res.status(403).json({ message: 'Нямате достъп до тази сграда' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Грешка при проверка на достъпа' });
  }
}; 