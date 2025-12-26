const mongoose = require('mongoose');

const vaultItemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['password', 'document', 'payslip', 'photo', 'personal'],
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },

  // For passwords
  website: String,
  username: String,
  password: String,  // Encrypted using AES-256-GCM in routes

  // For files
  fileData: Buffer,        // Store file directly in document (for small files)
  fileName: String,
  fileType: String,
  fileSize: Number,

  // Common fields
  notes: String,
  tags: [String],
  favorite: {
    type: Boolean,
    default: false
  },

  // Soft delete
  deleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date

}, {
  timestamps: true  // adds createdAt and updatedAt
});

// Text index for search
vaultItemSchema.index({
  name: 'text',
  website: 'text',
  username: 'text',
  notes: 'text',
  tags: 'text'
});

// Compound index for efficient queries
vaultItemSchema.index({ userId: 1, deleted: 1, category: 1 });

module.exports = mongoose.model('VaultItem', vaultItemSchema);
