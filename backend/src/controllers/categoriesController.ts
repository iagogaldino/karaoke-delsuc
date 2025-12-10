import { Request, Response } from 'express';
import {
  getAllCategories,
  getCategoryById,
  addCategory,
  updateCategory,
  removeCategory,
  moveSongToCategory,
} from '../utils/database.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/categories
 * List all categories
 */
export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const categories = getAllCategories();
  res.json({
    categories,
    total: categories.length
  });
});

/**
 * GET /api/categories/:id
 * Get a specific category
 */
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const category = getCategoryById(req.params.id);
  
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json(category);
});

/**
 * POST /api/categories
 * Create a new category
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const { name, description } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const newCategory = addCategory(name.trim(), description);
    res.status(201).json(newCategory);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }
});

/**
 * PUT /api/categories/:id
 * Update an existing category
 */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const updates = req.body;
  const updatedCategory = updateCategory(req.params.id, updates);

  if (!updatedCategory) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json(updatedCategory);
});

/**
 * DELETE /api/categories/:id
 * Remove a category (moves songs to "no category")
 */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const deleted = removeCategory(req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json({ message: 'Category deleted successfully' });
});

/**
 * POST /api/categories/move-song
 * Move a song to a category (categoryId can be null for "no category")
 */
export const moveSong = asyncHandler(async (req: Request, res: Response) => {
  const { songId, categoryId } = req.body;
  const finalCategoryId = categoryId === null || categoryId === undefined || categoryId === 'null' || categoryId === 'none' ? null : categoryId;

  if (!songId) {
    return res.status(400).json({ error: 'songId is required' });
  }

  try {
    const updatedSong = moveSongToCategory(songId, finalCategoryId);
    
    if (!updatedSong) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.json(updatedSong);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
});

