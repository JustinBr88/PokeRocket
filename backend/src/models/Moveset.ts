import mongoose, { Schema } from 'mongoose';

export const MovesetEntrySchema = new Schema({
  moveId: { type: Number, required: true },
  moveName: { type: String, required: true },
  type: { type: String, required: true },
  power: { type: Number, default: null },
  accuracy: { type: Number, default: null },
  damageClass: { type: String, enum: ['physical', 'special', 'status'] },
  priority: { type: Number, default: 0 },
  category: { type: String, enum: ['damage', 'healing', 'setup', 'ailment', 'debuff'] },
  soundPath: { type: String, default: null },
  famous: { type: Boolean, default: false },
});

export const MovesetSchema = new Schema({
  pokemonId: { type: Number, required: true, unique: true },
  pokemonName: { type: String, required: true },
  role: { type: String, enum: ['Fisico', 'Especial', 'Tanque', 'Asesino', 'Soporte', 'Mixto'], required: true },
  moves: [MovesetEntrySchema],
});

export const MovesetModel = mongoose.model('Moveset', MovesetSchema);