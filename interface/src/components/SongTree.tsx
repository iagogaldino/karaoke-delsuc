import { useState, useMemo } from 'react';
import { Song, Category, Band } from '../types/index.js';
import CreateBandButton from './CreateBandButton.js';
import CreateCategoryButton from './CreateCategoryButton.js';
import './SongTree.css';

interface SongTreeProps {
  songs: Song[];
  categories: Category[];
  bands: Band[];
  selectedSong: string | null;
  editingSongName: string | null;
  editedSongName: string;
  processingVideo: { [songId: string]: boolean };
  generatingLRC: { [songId: string]: boolean };
  onSongSelect: (songId: string) => void;
  onEditSongName: (song: Song, e: React.MouseEvent) => void;
  onSaveSongName: (songId: string) => void;
  onCancelEditSongName: () => void;
  onEditedSongNameChange: (value: string) => void;
  onDownloadVideo: (songId: string, e: React.MouseEvent) => void;
  onGenerateLRC: (songId: string, e: React.MouseEvent) => void;
  onDeleteSong: (songId: string, e: React.MouseEvent) => void;
  onSongMoved?: (songId: string) => void;
  onSongsMoved?: (songIds: string[]) => void;
  onBandUpdated?: (bandId: string) => void;
}

export default function SongTree({
  songs,
  categories,
  bands,
  selectedSong,
  editingSongName,
  editedSongName,
  processingVideo,
  generatingLRC,
  onSongSelect,
  onEditSongName,
  onSaveSongName,
  onCancelEditSongName,
  onEditedSongNameChange,
  onDownloadVideo,
  onGenerateLRC,
  onDeleteSong,
  onBandsUpdate,
  onCategoriesUpdate,
  onSongMoved,
  onSongsMoved,
  onBandUpdated
}: SongTreeProps) {
  const [editingBand, setEditingBand] = useState<string | null>(null);
  const [editedBandName, setEditedBandName] = useState<string>('');
  const [editedBandDesc, setEditedBandDesc] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editedCategoryName, setEditedCategoryName] = useState<string>('');
  const [editedCategoryDesc, setEditedCategoryDesc] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedBands, setExpandedBands] = useState<Set<string>>(new Set());
  const [expandedAll, setExpandedAll] = useState(false);

  // Separar músicas sem banda e agrupar as restantes por categoria e banda
  const { songsWithoutBand, songsByCategoryAndBand } = useMemo(() => {
    const songsWithoutBandList: Song[] = [];
    const grouped: { [categoryId: string]: { [bandId: string]: Song[] } } = {};

    // Inicializar todas as categorias
    categories.forEach(category => {
      grouped[category.id] = {};
      bands.forEach(band => {
        grouped[category.id][band.id] = [];
      });
    });

    // Inicializar "uncategorized"
    grouped.uncategorized = {};
    bands.forEach(band => {
      grouped.uncategorized[band.id] = [];
    });

    // Agrupar músicas
    songs.forEach(song => {
      // Se a música não tem banda, adiciona à lista separada
      if (!song.band) {
        songsWithoutBandList.push(song);
      } else {
        // Música com banda: agrupa por categoria e banda
        const categoryId = song.category || 'uncategorized';
        const bandId = song.band;

        if (!grouped[categoryId]) {
          grouped[categoryId] = {};
          bands.forEach(band => {
            grouped[categoryId][band.id] = [];
          });
        }

        if (!grouped[categoryId][bandId]) {
          grouped[categoryId][bandId] = [];
        }

        grouped[categoryId][bandId].push(song);
      }
    });

    // Adicionar bandas sem músicas na categoria padrão delas
    bands.forEach(band => {
      const bandSongs = songs.filter(s => s.band === band.id);
      const hasCategorizedSongs = bandSongs.some(s => s.category && s.category !== 'uncategorized');
      
      // Se a banda não tem músicas categorizadas
      if (!hasCategorizedSongs) {
        // Se a banda tem uma categoria padrão definida, adiciona nessa categoria
        if (band.category) {
          if (!grouped[band.category]) {
            grouped[band.category] = {};
            bands.forEach(b => {
              grouped[band.category!][b.id] = [];
            });
          }
          if (!grouped[band.category][band.id]) {
            grouped[band.category][band.id] = [];
          }
        } else {
          // Se não tem categoria padrão, vai para "uncategorized"
          if (!grouped.uncategorized[band.id]) {
            grouped.uncategorized[band.id] = [];
          }
        }
      }
    });

    return { songsWithoutBand: songsWithoutBandList, songsByCategoryAndBand: grouped };
  }, [songs, categories, bands]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const toggleBand = (categoryId: string, bandId: string) => {
    const key = `${categoryId}-${bandId}`;
    setExpandedBands(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const toggleExpandAll = () => {
    if (expandedAll) {
      setExpandedCategories(new Set());
      setExpandedBands(new Set());
    } else {
      const allCategoryIds = ['uncategorized', ...categories.map(cat => cat.id)];
      setExpandedCategories(new Set(allCategoryIds));
      
      const allBandKeys: string[] = [];
      // Adicionar "all-noband" para a pasta única de sem banda
      if (songsWithoutBand.length > 0) {
        allBandKeys.push('all-noband');
      }
      // Adicionar bandas dentro de cada categoria
      allCategoryIds.forEach(categoryId => {
        bands.forEach(band => {
          allBandKeys.push(`${categoryId}-${band.id}`);
        });
      });
      setExpandedBands(new Set(allBandKeys));
    }
    setExpandedAll(!expandedAll);
  };

  const getCategoryName = (categoryId: string) => {
    if (categoryId === 'uncategorized') {
      return 'Sem categoria';
    }
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || 'Desconhecida';
  };

  const getBandName = (bandId: string) => {
    if (bandId === 'noband') {
      return 'Sem banda';
    }
    const band = bands.find(b => b.id === bandId);
    return band?.name || 'Desconhecida';
  };

  const handleEditBand = async (band: Band, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBand(band.id);
    setEditedBandName(band.name);
    setEditedBandDesc(band.description || '');
  };

  const handleSaveBand = async (bandId: string) => {
    if (!editedBandName.trim()) {
      alert('Nome da banda é obrigatório');
      return;
    }
    try {
      const { bandsService } = await import('../services/bandsService.js');
      await bandsService.update(bandId, {
        name: editedBandName.trim(),
        description: editedBandDesc.trim() || undefined
      });
      setEditingBand(null);
      setEditedBandName('');
      setEditedBandDesc('');
      if (onBandsUpdate) {
        onBandsUpdate();
      }
    } catch (error: any) {
      console.error('Error updating band:', error);
      alert(error.message || 'Erro ao atualizar banda');
    }
  };

  const handleDeleteBand = async (bandId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja deletar esta banda? As músicas serão movidas para "Sem banda".')) {
      return;
    }
    try {
      const { bandsService } = await import('../services/bandsService.js');
      await bandsService.delete(bandId);
      // Recarregar dados após deletar banda (pode ter afetado músicas)
      if (onBandsUpdate) {
        onBandsUpdate();
      }
    } catch (error: any) {
      console.error('Error deleting band:', error);
      alert(error.message || 'Erro ao deletar banda');
    }
  };

  const handleEditCategory = async (category: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(category.id);
    setEditedCategoryName(category.name);
    setEditedCategoryDesc(category.description || '');
  };

  const handleSaveCategory = async (categoryId: string) => {
    if (!editedCategoryName.trim()) {
      alert('Nome da categoria é obrigatório');
      return;
    }
    try {
      const { categoriesService } = await import('../services/categoriesService.js');
      await categoriesService.update(categoryId, {
        name: editedCategoryName.trim(),
        description: editedCategoryDesc.trim() || undefined
      });
      setEditingCategory(null);
      setEditedCategoryName('');
      setEditedCategoryDesc('');
      if (onCategoriesUpdate) {
        onCategoriesUpdate();
      }
    } catch (error: any) {
      console.error('Error updating category:', error);
      alert(error.message || 'Erro ao atualizar categoria');
    }
  };

  const handleDeleteCategory = async (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja deletar esta categoria? As músicas serão movidas para "Sem categoria".')) {
      return;
    }
    try {
      const { categoriesService } = await import('../services/categoriesService.js');
      await categoriesService.delete(categoryId);
      // Recarregar dados após deletar categoria (pode ter afetado músicas)
      if (onCategoriesUpdate) {
        onCategoriesUpdate();
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(error.message || 'Erro ao deletar categoria');
    }
  };


  const handleDragStart = (e: React.DragEvent, song: Song) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ songId: song.id, type: 'song' }));
    e.currentTarget.classList.add('dragging');
  };

  const handleBandDragStart = (e: React.DragEvent, bandId: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ bandId, type: 'band' }));
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('dragging');
    // Remove todas as classes de drop zones
    document.querySelectorAll('.drop-zone-active').forEach(el => el.classList.remove('drop-zone-active'));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!e.currentTarget.classList.contains('drop-zone-active')) {
      e.currentTarget.classList.add('drop-zone-active');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drop-zone-active');
  };

  const handleDrop = async (e: React.DragEvent, targetCategoryId: string | null, targetBandId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drop-zone-active');

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) {
        console.log('No data found in drag event');
        return;
      }
      
      const data = JSON.parse(dataStr);
      console.log('Drop event received:', {
        type: data.type,
        itemId: data.songId || data.bandId,
        targetCategory: targetCategoryId,
        targetBand: targetBandId
      });
      
      // Importar serviços dinamicamente para evitar dependência circular
      const { bandsService } = await import('../services/bandsService.js');
      const { categoriesService } = await import('../services/categoriesService.js');

      if (data.type === 'song' && data.songId) {
        const { songId } = data;
        const song = songs.find(s => s.id === songId);
        if (!song) return;

        // Normalizar IDs
        const normalizedCategoryId = targetCategoryId === 'uncategorized' ? null : targetCategoryId;
        const normalizedBandId = targetBandId === 'noband' ? null : targetBandId;

        let needsUpdate = false;

        // Se mudou a categoria
        const currentCategoryId = song.category || null;
        if (normalizedCategoryId !== currentCategoryId) {
          await categoriesService.moveSong(songId, normalizedCategoryId);
          needsUpdate = true;
        }

        // Se mudou a banda
        const currentBandId = song.band || null;
        if (normalizedBandId !== currentBandId) {
          await bandsService.moveSong(songId, normalizedBandId);
          needsUpdate = true;
        }

        if (needsUpdate) {
          // Atualizar apenas esta música
          if (onSongMoved) {
            onSongMoved(songId);
          }
        }
      } else if (data.type === 'band' && data.bandId) {
        // Mover todas as músicas da banda para a categoria de destino
        const { bandId } = data;
        
        // Se targetCategoryId é null, não faz nada (não pode mover para lugar nenhum)
        if (targetCategoryId === null) {
          console.log('Cannot move band: targetCategoryId is null');
          return;
        }
        
        const normalizedCategoryId = targetCategoryId === 'uncategorized' ? null : targetCategoryId;
        console.log('Moving band', bandId, 'to category', normalizedCategoryId);
        
        // Buscar todas as músicas dessa banda
        const bandSongs = songs.filter(s => s.band === bandId);
        console.log('Band songs found:', bandSongs.length);
        
        // Se não tem músicas, atualiza a categoria padrão da banda
        if (bandSongs.length === 0) {
          console.log('Banda não tem músicas, atualizando categoria padrão da banda');
          try {
            await bandsService.update(bandId, { category: normalizedCategoryId || undefined });
            console.log('Categoria da banda atualizada com sucesso');
            
            // Atualizar apenas esta banda
            if (onBandUpdated) {
              onBandUpdated(bandId);
            }
          } catch (error) {
            console.error('Erro ao atualizar categoria da banda:', error);
            alert('Erro ao atualizar categoria da banda: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
          }
          return;
        }
        
        // Mover cada música para a nova categoria
        const songsToMove = bandSongs.filter(song => {
          const currentCategoryId = song.category || null;
          return normalizedCategoryId !== currentCategoryId;
        });

        if (songsToMove.length === 0) {
          console.log('Todas as músicas da banda já estão nesta categoria');
          // Se apenas a categoria da banda mudou, atualizar a banda
          const band = bands.find(b => b.id === bandId);
          if (band && (band.category || null) !== normalizedCategoryId) {
            await bandsService.update(bandId, { category: normalizedCategoryId || undefined });
            if (onBandUpdated) {
              onBandUpdated(bandId);
            }
          }
          return;
        }

        console.log(`Movendo ${songsToMove.length} música(s) para a categoria ${normalizedCategoryId || 'uncategorized'}`);

        const movePromises = songsToMove.map(song => {
          console.log('Moving song', song.id, 'from category', song.category || null, 'to', normalizedCategoryId);
          return categoriesService.moveSong(song.id, normalizedCategoryId);
        });

        const results = await Promise.all(movePromises);
        console.log('All songs moved successfully:', results.length, 'songs updated');
        
        // Atualizar também a categoria padrão da banda para que novas músicas herdem
        try {
          await bandsService.update(bandId, { category: normalizedCategoryId || undefined });
          console.log('Categoria padrão da banda atualizada');
          
          // Atualizar a banda
          if (onBandUpdated) {
            onBandUpdated(bandId);
          }
        } catch (error) {
          console.error('Erro ao atualizar categoria padrão da banda:', error);
          // Não falhar o processo se isso der erro
        }
        
        // Atualizar apenas as músicas que foram movidas
        const movedSongIds = songsToMove.map(s => s.id);
        if (onSongsMoved && movedSongIds.length > 0) {
          onSongsMoved(movedSongIds);
        }
      } else {
        console.log('Unknown drag type or missing data:', data);
      }
    } catch (error) {
      console.error('Error moving item:', error);
      alert('Erro ao mover item: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const renderSong = (song: Song) => {
    const isSelected = selectedSong === song.id;
    const isEditing = editingSongName === song.id;

    return (
      <div
        key={song.id}
        className={`song-tree-item ${isSelected ? 'active' : ''} ${song.status.ready ? 'ready' : 'processing'}`}
        onClick={() => !isEditing && onSongSelect(song.id)}
        draggable={!isEditing}
        onDragStart={(e) => handleDragStart(e, song)}
        onDragEnd={handleDragEnd}
        title={song.status.ready ? 'Pronta para tocar (arraste para mover)' : 'Processamento incompleto'}
      >
        {isEditing ? (
          <div className="song-name-edit" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editedSongName}
              onChange={(e) => onEditedSongNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSaveSongName(song.id);
                } else if (e.key === 'Escape') {
                  onCancelEditSongName();
                }
              }}
              className="song-name-input"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="save-name-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSaveSongName(song.id);
              }}
              title="Salvar"
            >
              <i className="fas fa-check"></i>
            </button>
            <button
              className="cancel-name-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCancelEditSongName();
              }}
              title="Cancelar"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ) : (
          <div className="song-name-container">
            <span className="song-name">{song.displayName || song.name}</span>
            <button
              className="edit-name-btn"
              onClick={(e) => onEditSongName(song, e)}
              title="Editar nome"
            >
              <i className="fas fa-edit"></i>
            </button>
          </div>
        )}
        <div className="song-actions">
          {song.status.ready && (
            <span className="play-icon"><i className="fas fa-play"></i></span>
          )}
          {!song.status.ready && (
            <span className="processing-icon" title="Processamento incompleto">
              <i className="fas fa-hourglass-half"></i>
            </span>
          )}
          {song.status.ready && (
            <button
              className="video-btn"
              onClick={(e) => onDownloadVideo(song.id, e)}
              title={song.files?.video ? "Reprocessar vídeo do YouTube" : "Processar vídeo do YouTube"}
              disabled={processingVideo[song.id]}
            >
              {processingVideo[song.id] ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : song.files?.video ? (
                <i className="fas fa-redo"></i>
              ) : (
                <i className="fas fa-video"></i>
              )}
            </button>
          )}
          <button
            className="lrc-btn"
            onClick={(e) => onGenerateLRC(song.id, e)}
            title={song.files?.lyrics ? "Regenerar letras LRC" : "Gerar letras LRC"}
            disabled={generatingLRC[song.id]}
          >
            {generatingLRC[song.id] ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-file-alt"></i>
            )}
          </button>
          <button
            className="delete-btn"
            onClick={(e) => onDeleteSong(song.id, e)}
            title="Remover música"
          >
            <i className="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="song-tree">
      <div className="song-tree-header">
        <h3>Músicas</h3>
        <div className="song-tree-header-actions">
          <CreateCategoryButton
            variant="inline"
            buttonText=""
            onCategoryCreated={() => {
              if (onCategoriesUpdate) {
                onCategoriesUpdate();
              }
            }}
          />
          <CreateBandButton
            variant="inline"
            buttonText=""
            categories={categories}
            onBandCreated={() => {
              if (onBandsUpdate) {
                onBandsUpdate();
              }
            }}
          />
          <button
            className="expand-all-btn"
            onClick={toggleExpandAll}
            title={expandedAll ? "Recolher todas" : "Expandir todas"}
          >
            <i className={`fas ${expandedAll ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
            {expandedAll ? 'Recolher' : 'Expandir'}
          </button>
        </div>
      </div>

      <div className="song-tree-content">
        {/* Músicas sem banda - pasta única no topo */}
        {songsWithoutBand.length > 0 && (
          <div className="song-tree-band drop-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null, 'noband')}
          >
            <div
              className="song-tree-band-header"
              onClick={() => toggleBand('all', 'noband')}
            >
              <i className="fas fa-music"></i>
              <span className="band-name">Sem banda</span>
              <span className="song-count">({songsWithoutBand.length})</span>
            </div>
            {expandedBands.has('all-noband') && (
              <div className="song-tree-band-content">
                <div className="song-tree-songs">
                  {songsWithoutBand.map(song => renderSong(song))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Categorias */}
        {/* Sem categoria primeiro */}
        {(() => {
          const uncategorizedBands = songsByCategoryAndBand.uncategorized || {};
          const totalSongs = Object.values(uncategorizedBands).flat().length;
          const isExpanded = expandedCategories.has('uncategorized');

          return (
            <div 
              className="song-tree-category drop-zone" 
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDragOver(e);
              }}
              onDragLeave={handleDragLeave} 
              onDrop={(e) => {
                e.stopPropagation();
                handleDrop(e, 'uncategorized', null);
              }}
            >
              <div
                className="song-tree-category-header"
                onClick={() => toggleCategory('uncategorized')}
              >
                <i className="fas fa-folder-open"></i>
                <span className="category-name">{getCategoryName('uncategorized')}</span>
                <span className="song-count">({totalSongs})</span>
              </div>
              {isExpanded && (
                <div className="song-tree-category-content">

                  {/* Bandas dentro desta categoria (incluindo bandas sem músicas ou sem categoria) */}
                  {bands.map(band => {
                    const bandSongs = uncategorizedBands[band.id] || [];
                    // Mostrar bandas que têm músicas sem categoria OU bandas sem categoria padrão definida
                    const hasCategorizedSongs = songs.filter(s => s.band === band.id).some(s => s.category && s.category !== 'uncategorized');
                    const hasDefaultCategory = band.category && band.category !== 'uncategorized';
                    // Não mostrar se tem músicas categorizadas em outra categoria OU se tem categoria padrão diferente
                    if (bandSongs.length === 0 && (hasCategorizedSongs || hasDefaultCategory)) return null;
                    const bandKey = `uncategorized-${band.id}`;

                    return (
                      <div
                        key={band.id}
                        className="song-tree-band drop-zone"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, 'uncategorized', band.id)}
                      >
                        <div
                          className="song-tree-band-header"
                          draggable
                          onDragStart={(e) => handleBandDragStart(e, band.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => toggleBand('uncategorized', band.id)}
                        >
                          <i className="fas fa-users"></i>
                          {editingBand === band.id ? (
                            <div className="edit-form" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editedBandName}
                                onChange={(e) => setEditedBandName(e.target.value)}
                                className="edit-input"
                                placeholder="Nome da banda"
                                autoFocus
                              />
                              <input
                                type="text"
                                value={editedBandDesc}
                                onChange={(e) => setEditedBandDesc(e.target.value)}
                                className="edit-input"
                                placeholder="Descrição (opcional)"
                              />
                              <button
                                className="save-name-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveBand(band.id);
                                }}
                                title="Salvar"
                              >
                                <i className="fas fa-check"></i>
                              </button>
                              <button
                                className="cancel-name-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingBand(null);
                                  setEditedBandName('');
                                  setEditedBandDesc('');
                                }}
                                title="Cancelar"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="band-name">{band.name}</span>
                              <span className="song-count">({bandSongs.length})</span>
                              <div className="band-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="edit-name-btn"
                                  onClick={(e) => handleEditBand(band, e)}
                                  title="Editar banda"
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button
                                  className="delete-name-btn"
                                  onClick={(e) => handleDeleteBand(band.id, e)}
                                  title="Deletar banda"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        {expandedBands.has(bandKey) && (
                          <div className="song-tree-band-content">
                            <div className="song-tree-songs">
                              {bandSongs.map(song => renderSong(song))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Outras categorias */}
        {categories.map(category => {
          const categoryBands = songsByCategoryAndBand[category.id] || {};
          const totalSongs = Object.values(categoryBands).flat().length;
          const isExpanded = expandedCategories.has(category.id);

          return (
            <div
              key={category.id}
              className="song-tree-category drop-zone"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDragOver(e);
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                e.stopPropagation();
                handleDrop(e, category.id, null);
              }}
            >
              <div
                className="song-tree-category-header"
                onClick={() => toggleCategory(category.id)}
                onDrop={(e) => e.stopPropagation()}
              >
                <i className="fas fa-folder"></i>
                {editingCategory === category.id ? (
                  <div className="edit-form" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editedCategoryName}
                      onChange={(e) => setEditedCategoryName(e.target.value)}
                      className="edit-input"
                      placeholder="Nome da categoria"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editedCategoryDesc}
                      onChange={(e) => setEditedCategoryDesc(e.target.value)}
                      className="edit-input"
                      placeholder="Descrição (opcional)"
                    />
                    <button
                      className="save-name-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveCategory(category.id);
                      }}
                      title="Salvar"
                    >
                      <i className="fas fa-check"></i>
                    </button>
                    <button
                      className="cancel-name-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCategory(null);
                        setEditedCategoryName('');
                        setEditedCategoryDesc('');
                      }}
                      title="Cancelar"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="category-name">{category.name}</span>
                    <span className="song-count">({totalSongs})</span>
                    <div className="category-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="edit-name-btn"
                        onClick={(e) => handleEditCategory(category, e)}
                        title="Editar categoria"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        className="delete-name-btn"
                        onClick={(e) => handleDeleteCategory(category.id, e)}
                        title="Deletar categoria"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </>
                )}
              </div>
              {isExpanded && (
                <div className="song-tree-category-content">

                  {/* Bandas dentro desta categoria (bandas com músicas ou categoria padrão) */}
                  {bands.map(band => {
                    const bandSongs = categoryBands[band.id] || [];
                    // Mostrar se tem músicas nesta categoria OU se a categoria padrão da banda é esta
                    const hasSongsInCategory = bandSongs.length > 0;
                    const hasDefaultCategory = band.category === category.id;
                    if (!hasSongsInCategory && !hasDefaultCategory) return null;
                    const bandKey = `${category.id}-${band.id}`;

                    return (
                      <div
                        key={band.id}
                        className="song-tree-band drop-zone"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, category.id, band.id)}
                      >
                        <div
                          className="song-tree-band-header"
                          draggable
                          onDragStart={(e) => handleBandDragStart(e, band.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => toggleBand(category.id, band.id)}
                        >
                          <i className="fas fa-users"></i>
                          {editingBand === band.id ? (
                            <div className="edit-form" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editedBandName}
                                onChange={(e) => setEditedBandName(e.target.value)}
                                className="edit-input"
                                placeholder="Nome da banda"
                                autoFocus
                              />
                              <input
                                type="text"
                                value={editedBandDesc}
                                onChange={(e) => setEditedBandDesc(e.target.value)}
                                className="edit-input"
                                placeholder="Descrição (opcional)"
                              />
                              <button
                                className="save-name-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveBand(band.id);
                                }}
                                title="Salvar"
                              >
                                <i className="fas fa-check"></i>
                              </button>
                              <button
                                className="cancel-name-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingBand(null);
                                  setEditedBandName('');
                                  setEditedBandDesc('');
                                }}
                                title="Cancelar"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="band-name">{band.name}</span>
                              <span className="song-count">({bandSongs.length})</span>
                              <div className="band-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="edit-name-btn"
                                  onClick={(e) => handleEditBand(band, e)}
                                  title="Editar banda"
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button
                                  className="delete-name-btn"
                                  onClick={(e) => handleDeleteBand(band.id, e)}
                                  title="Deletar banda"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        {expandedBands.has(bandKey) && (
                          <div className="song-tree-band-content">
                            <div className="song-tree-songs">
                              {bandSongs.map(song => renderSong(song))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Se não houver músicas */}
        {songs.length === 0 && categories.length === 0 && (
          <div className="songs-empty">
            <p>Nenhuma música encontrada</p>
            <p className="songs-empty-hint">Processe uma música para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}

