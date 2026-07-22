// src/utils/unitConverter.js

const LBS_PER_KG = 2.20462;

/**
 * Converts stored base weight (kg) to display weight in user preference unit.
 * @param {number} weightKg - Raw weight from database (in kg)
 * @param {string} targetUnit - 'lbs' or 'kg'
 * @returns {number} Formatted number for UI display
 */
export const toDisplayWeight = (weightKg, targetUnit = 'lbs') => {
  if (weightKg == null || isNaN(weightKg)) return 0;
  
  const unit = targetUnit.toLowerCase();
  const value = unit === 'lbs' ? weightKg * LBS_PER_KG : weightKg;
  
  // Round to 1 decimal place (e.g., 100.5 instead of 100.45321)
  return Math.round(value * 10) / 10;
};

/**
 * Converts user input weight into base kilograms for backend storage.
 * @param {number|string} inputWeight - Weight entered by user in UI form
 * @param {string} userUnit - 'lbs' or 'kg'
 * @returns {number} Standardized weight in kg
 */
export const toBaseKg = (inputWeight, userUnit = 'lbs') => {
  const num = Number(inputWeight);
  if (isNaN(num) || num <= 0) return 0;

  const unit = userUnit.toLowerCase();
  const kgValue = unit === 'lbs' ? num / LBS_PER_KG : num;

  // Round to 2 decimal places for precise DB storage
  return Math.round(kgValue * 100) / 100;
};