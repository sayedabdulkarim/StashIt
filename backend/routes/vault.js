const express = require('express');
const router = express.Router();
const multer = require('multer');
const VaultItem = require('../models/VaultItem');
const auth = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

// Multer config for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// All routes require authentication
router.use(auth);

// @route   GET /api/vault
// @desc    Get all vault items (with optional category filter)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    const query = {
      userId: req.userId,
      deleted: false
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    const items = await VaultItem.find(query)
      .select('-fileData') // Exclude file data for listing
      .sort({ favorite: -1, updatedAt: -1 });

    // Decrypt passwords for response
    const decryptedItems = items.map(item => {
      const obj = item.toObject();
      if (obj.password) {
        obj.password = decrypt(obj.password);
      }
      return obj;
    });

    res.json(decryptedItems);
  } catch (error) {
    console.error('Get vault items error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// @route   GET /api/vault/search
// @desc    Search vault items (global or by category)
// @access  Private
router.get('/search', async (req, res) => {
  try {
    const { q, category } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const query = {
      userId: req.userId,
      deleted: false,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { website: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } }
      ]
    };

    // Category filter for category-specific search
    if (category && category !== 'all') {
      query.category = category;
    }

    const items = await VaultItem.find(query)
      .select('-fileData')
      .sort({ favorite: -1, updatedAt: -1 })
      .limit(50);

    // Decrypt passwords for response
    const decryptedItems = items.map(item => {
      const obj = item.toObject();
      if (obj.password) {
        obj.password = decrypt(obj.password);
      }
      return obj;
    });

    res.json(decryptedItems);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// @route   GET /api/vault/trash
// @desc    Get deleted items (trash)
// @access  Private
router.get('/trash', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const items = await VaultItem.find({
      userId: req.userId,
      deleted: true,
      deletedAt: { $gte: thirtyDaysAgo }
    })
      .select('-fileData')
      .sort({ deletedAt: -1 });

    // Decrypt passwords for response
    const decryptedItems = items.map(item => {
      const obj = item.toObject();
      if (obj.password) {
        obj.password = decrypt(obj.password);
      }
      return obj;
    });

    res.json(decryptedItems);
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

// @route   GET /api/vault/stats
// @desc    Get vault statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const stats = await VaultItem.aggregate([
      { $match: { userId: req.userId, deleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const result = {
      password: 0,
      document: 0,
      payslip: 0,
      photo: 0,
      personal: 0,
      total: 0
    };

    stats.forEach(s => {
      result[s._id] = s.count;
      result.total += s.count;
    });

    res.json(result);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// @route   GET /api/vault/:id
// @desc    Get single vault item
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const item = await VaultItem.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Decrypt password for response
    const obj = item.toObject();
    if (obj.password) {
      obj.password = decrypt(obj.password);
    }

    res.json(obj);
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// @route   GET /api/vault/:id/file
// @desc    Get file data for an item
// @access  Private
router.get('/:id/file', async (req, res) => {
  try {
    const item = await VaultItem.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!item || !item.fileData) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.set({
      'Content-Type': item.fileType,
      'Content-Disposition': `inline; filename="${item.fileName}"`,
      'Content-Length': item.fileSize
    });

    res.send(item.fileData);
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// @route   POST /api/vault
// @desc    Create new vault item
// @access  Private
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { category, name, website, username, password, notes, tags } = req.body;

    if (!category || !name) {
      return res.status(400).json({ error: 'Category and name are required' });
    }

    const itemData = {
      userId: req.userId,
      category,
      name,
      website,
      username,
      password: password ? encrypt(password) : undefined,  // Encrypt password before storing
      notes,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : []
    };

    // Handle file upload
    if (req.file) {
      itemData.fileData = req.file.buffer;
      itemData.fileName = req.file.originalname;
      itemData.fileType = req.file.mimetype;
      itemData.fileSize = req.file.size;
    }

    const item = await VaultItem.create(itemData);

    // Return without fileData, with decrypted password
    const response = item.toObject();
    delete response.fileData;
    if (response.password) {
      response.password = decrypt(response.password);
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// @route   PUT /api/vault/:id
// @desc    Update vault item
// @access  Private
router.put('/:id', upload.single('file'), async (req, res) => {
  try {
    const { name, website, username, password, notes, tags, favorite } = req.body;

    const item = await VaultItem.findOne({
      _id: req.params.id,
      userId: req.userId,
      deleted: false
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Update fields
    if (name) item.name = name;
    if (website !== undefined) item.website = website;
    if (username !== undefined) item.username = username;
    if (password !== undefined) item.password = password ? encrypt(password) : '';  // Encrypt password before storing
    if (notes !== undefined) item.notes = notes;
    if (tags) item.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    if (favorite !== undefined) item.favorite = favorite === 'true' || favorite === true;

    // Handle file update
    if (req.file) {
      item.fileData = req.file.buffer;
      item.fileName = req.file.originalname;
      item.fileType = req.file.mimetype;
      item.fileSize = req.file.size;
    }

    await item.save();

    // Return without fileData, with decrypted password
    const response = item.toObject();
    delete response.fileData;
    if (response.password) {
      response.password = decrypt(response.password);
    }

    res.json(response);
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// @route   DELETE /api/vault/:id
// @desc    Soft delete vault item
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const item = await VaultItem.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Soft delete
    item.deleted = true;
    item.deletedAt = new Date();
    await item.save();

    res.json({ message: 'Item moved to trash' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// @route   POST /api/vault/:id/restore
// @desc    Restore item from trash
// @access  Private
router.post('/:id/restore', async (req, res) => {
  try {
    const item = await VaultItem.findOne({
      _id: req.params.id,
      userId: req.userId,
      deleted: true
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found in trash' });
    }

    item.deleted = false;
    item.deletedAt = null;
    await item.save();

    res.json({ message: 'Item restored' });
  } catch (error) {
    console.error('Restore item error:', error);
    res.status(500).json({ error: 'Failed to restore item' });
  }
});

// @route   DELETE /api/vault/:id/permanent
// @desc    Permanently delete item
// @access  Private
router.delete('/:id/permanent', async (req, res) => {
  try {
    const result = await VaultItem.deleteOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item permanently deleted' });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// @route   POST /api/vault/export
// @desc    Export all vault items
// @access  Private
router.post('/export', async (req, res) => {
  try {
    const items = await VaultItem.find({
      userId: req.userId,
      deleted: false
    }).select('-fileData');

    // Decrypt passwords for export
    const decryptedItems = items.map(item => {
      const obj = item.toObject();
      if (obj.password) {
        obj.password = decrypt(obj.password);
      }
      return obj;
    });

    res.json({
      exportedAt: new Date().toISOString(),
      itemCount: decryptedItems.length,
      items: decryptedItems
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export vault' });
  }
});

// @route   POST /api/vault/import
// @desc    Import vault items from backup
// @access  Private
router.post('/import', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid import data. Expected { items: [...] }' });
    }

    let imported = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        // Validate required fields
        if (!item.category || !item.name) {
          skipped++;
          continue;
        }

        // Create new item with encrypted password
        const itemData = {
          userId: req.userId,
          category: item.category,
          name: item.name,
          website: item.website || '',
          username: item.username || '',
          password: item.password ? encrypt(item.password) : '',
          notes: item.notes || '',
          tags: item.tags || [],
          favorite: item.favorite || false
        };

        await VaultItem.create(itemData);
        imported++;
      } catch (itemError) {
        console.error('Import item error:', itemError);
        skipped++;
      }
    }

    res.json({
      message: 'Import completed',
      imported,
      skipped,
      total: items.length
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import vault' });
  }
});

module.exports = router;
