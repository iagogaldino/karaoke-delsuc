import { useState, useEffect } from 'react';
import { Category, Song } from '../types/index.js';
import { categoriesService } from '../services/categoriesService.js';
import { songsService } from '../services/songsService.js';
import { bandsService } from '../services/bandsService.js';
import './CategoryManager.css';

interface CategoryManagerProps {
  songs: Song[];
  onSongsUpdate: () => void;
}

export default function CategoryManager({ songs, onSongsUpdate }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [movingSong, setMovingSong] = useState<string | null>(null);
  const [showCreateBandForm, setShowCreateBandForm] = useState<string | null>(null);
  const [newBandName, setNewBandName] = useState('');
  const [newBandDesc, setNewBandDesc] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const cats = await categoriesService.getAll();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
      alert('Erro ao carregar categorias');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('Nome da categoria é obrigatório');
      return;
    }

    try {
      await categoriesService.create(newCategoryName.trim(), newCategoryDesc.trim() || undefined);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setShowCreateForm(false);
      await loadCategories();
    } catch (error: any) {
      console.error('Error creating category:', error);
      alert(error.message || 'Erro ao criar categoria');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category.id);
    setEditedName(category.name);
    setEditedDesc(category.description || '');
  };

  const handleSaveEdit = async (categoryId: string) => {
    if (!editedName.trim()) {
      alert('Nome da categoria é obrigatório');
      return;
    }

    try {
      await categoriesService.update(categoryId, {
        name: editedName.trim(),
        description: editedDesc.trim() || undefined
      });
      setEditingCategory(null);
      setEditedName('');
      setEditedDesc('');
      await loadCategories();
    } catch (error: any) {
      console.error('Error updating category:', error);
      alert(error.message || 'Erro ao atualizar categoria');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta categoria? As músicas serão movidas para "Sem categoria".')) {
      return;
    }

    try {
      await categoriesService.delete(categoryId);
      await loadCategories();
      onSongsUpdate(); // Recarregar músicas
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Erro ao deletar categoria');
    }
  };

  const handleMoveSong = async (songId: string, categoryId: string | null) => {
    try {
      setMovingSong(songId);
      await categoriesService.moveSong(songId, categoryId);
      await songsService.update(songId, { category: categoryId || undefined });
      onSongsUpdate(); // Recarregar músicas
    } catch (error) {
      console.error('Error moving song:', error);
      alert('Erro ao mover música');
    } finally {
      setMovingSong(null);
    }
  };

  const getSongsByCategory = (categoryId: string | null) => {
    return songs.filter(song => {
      if (categoryId === null) {
        return !song.category;
      }
      return song.category === categoryId;
    });
  };

  const handleCreateBand = async (categoryId: string | null) => {
    if (!newBandName.trim()) {
      alert('Nome da banda é obrigatório');
      return;
    }

    try {
      await bandsService.create(newBandName.trim(), newBandDesc.trim() || undefined);
      setNewBandName('');
      setNewBandDesc('');
      setShowCreateBandForm(null);
      onSongsUpdate(); // Recarregar para atualizar a lista
    } catch (error: any) {
      console.error('Error creating band:', error);
      alert(error.message || 'Erro ao criar banda');
    }
  };

  if (isLoading) {
    return <div className="category-manager-loading">Carregando categorias...</div>;
  }

  return (
    <div className="category-manager">
      <div className="category-manager-header">
        <h3>Organização de Músicas</h3>
        <button
          className="create-category-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <i className="fas fa-folder-plus"></i>
          {showCreateForm ? 'Cancelar' : 'Nova Categoria'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-category-form">
          <input
            type="text"
            placeholder="Nome da categoria (ex: Rock, Pop, Banda X)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateCategory();
              } else if (e.key === 'Escape') {
                setShowCreateForm(false);
              }
            }}
            autoFocus
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={newCategoryDesc}
            onChange={(e) => setNewCategoryDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateCategory();
              }
            }}
          />
          <button onClick={handleCreateCategory}>
            <i className="fas fa-check"></i> Criar
          </button>
        </div>
      )}

      <div className="categories-list">
        {/* Categoria "Sem categoria" */}
        <div className={`category-item ${selectedCategory === null ? 'active' : ''}`}>
          <div 
            className="category-header"
            onClick={() => setSelectedCategory(selectedCategory === null ? null : null)}
            style={{ cursor: 'pointer' }}
          >
            <div className="category-info">
              <i className="fas fa-folder-open"></i>
              <span className="category-name">Sem categoria</span>
              <span className="song-count">({getSongsByCategory(null).length})</span>
            </div>
          </div>
          {selectedCategory === null && (
            <div className="category-songs">
              <button
                className="add-band-btn"
                onClick={() => setShowCreateBandForm(showCreateBandForm === 'null' ? null : 'null')}
                title="Adicionar nova banda"
              >
                <i className="fas fa-users"></i>
                {showCreateBandForm === 'null' ? 'Cancelar' : 'Nova Banda'}
              </button>
              
              {showCreateBandForm === 'null' && (
                <div className="create-band-form">
                  <input
                    type="text"
                    placeholder="Nome da banda"
                    value={newBandName}
                    onChange={(e) => setNewBandName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateBand(null);
                      } else if (e.key === 'Escape') {
                        setShowCreateBandForm(null);
                        setNewBandName('');
                        setNewBandDesc('');
                      }
                    }}
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Descrição (opcional)"
                    value={newBandDesc}
                    onChange={(e) => setNewBandDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateBand(null);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleCreateBand(null)}
                    className="create-band-confirm-btn"
                  >
                    <i className="fas fa-check"></i> Criar
                  </button>
                </div>
              )}

              {getSongsByCategory(null).length === 0 ? (
                <div className="no-songs">Nenhuma música sem categoria</div>
              ) : (
                getSongsByCategory(null).map(song => (
                  <div key={song.id} className="category-song-item">
                    <span>{song.displayName || song.name}</span>
                    <select
                      value={song.category || ''}
                      onChange={(e) => handleMoveSong(song.id, e.target.value || null)}
                      disabled={movingSong === song.id}
                      onClick={(e) => e.stopPropagation()}
                      title="Mover para outra categoria"
                    >
                      <option value="">Sem categoria</option>
                      {categories.filter(cat => cat.id !== song.category).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {movingSong === song.id && (
                      <i className="fas fa-spinner fa-spin" style={{ marginLeft: '8px', color: '#667eea' }}></i>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Categorias */}
        {categories.map(category => (
          <div key={category.id} className={`category-item ${selectedCategory === category.id ? 'active' : ''}`}>
            <div 
              className="category-header"
              onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
            >
              <div className="category-info">
                <i className="fas fa-folder"></i>
                {editingCategory === category.id ? (
                  <div className="category-edit-form" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(category.id);
                        } else if (e.key === 'Escape') {
                          setEditingCategory(null);
                        }
                      }}
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editedDesc}
                      onChange={(e) => setEditedDesc(e.target.value)}
                      placeholder="Descrição"
                    />
                    <button
                      onClick={() => handleSaveEdit(category.id)}
                      className="save-btn"
                    >
                      <i className="fas fa-check"></i>
                    </button>
                    <button
                      onClick={() => setEditingCategory(null)}
                      className="cancel-btn"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="category-name">{category.name}</span>
                    {category.description && (
                      <span className="category-desc">{category.description}</span>
                    )}
                    <span className="song-count">({getSongsByCategory(category.id).length})</span>
                  </>
                )}
              </div>
              {editingCategory !== category.id && (
                <div className="category-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditCategory(category);
                    }}
                    className="edit-btn"
                    title="Editar categoria"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(category.id);
                    }}
                    className="delete-btn"
                    title="Deletar categoria"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              )}
            </div>
            {selectedCategory === category.id && (
              <div className="category-songs">
                <button
                  className="add-band-btn"
                  onClick={() => setShowCreateBandForm(showCreateBandForm === category.id ? null : category.id)}
                  title="Adicionar nova banda"
                >
                  <i className="fas fa-users"></i>
                  {showCreateBandForm === category.id ? 'Cancelar' : 'Nova Banda'}
                </button>
                
                {showCreateBandForm === category.id && (
                  <div className="create-band-form">
                    <input
                      type="text"
                      placeholder="Nome da banda"
                      value={newBandName}
                      onChange={(e) => setNewBandName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateBand(category.id);
                        } else if (e.key === 'Escape') {
                          setShowCreateBandForm(null);
                          setNewBandName('');
                          setNewBandDesc('');
                        }
                      }}
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="Descrição (opcional)"
                      value={newBandDesc}
                      onChange={(e) => setNewBandDesc(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateBand(category.id);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleCreateBand(category.id)}
                      className="create-band-confirm-btn"
                    >
                      <i className="fas fa-check"></i> Criar
                    </button>
                  </div>
                )}

                {getSongsByCategory(category.id).length === 0 ? (
                  <div className="no-songs">Nenhuma música nesta categoria</div>
                ) : (
                  getSongsByCategory(category.id).map(song => (
                    <div key={song.id} className="category-song-item">
                      <span>{song.displayName || song.name}</span>
                      <select
                        value={song.category || ''}
                        onChange={(e) => handleMoveSong(song.id, e.target.value || null)}
                        disabled={movingSong === song.id}
                        onClick={(e) => e.stopPropagation()}
                        title="Mover para outra categoria"
                      >
                        <option value="">Sem categoria</option>
                        {categories.filter(cat => cat.id !== song.category).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      {movingSong === song.id && (
                        <i className="fas fa-spinner fa-spin" style={{ marginLeft: '8px', color: '#667eea' }}></i>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

